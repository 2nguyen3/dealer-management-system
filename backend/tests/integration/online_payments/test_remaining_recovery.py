from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError
from app.modules.online_payments.repository import OnlinePaymentRepository
from app.modules.online_payments.schemas import Checkout, OnlinePaymentCreate, VerifiedPayment
from tests.integration.online_payments.test_recovery import use
from tests.integration.settlement_core.helpers import commit, issue

pytestmark = pytest.mark.integration


def test_pending_reconcile_resumes_setup_and_rechecks_expiry_and_fallback_failure(
    engine, actor, trading
):
    adapter = Mock()
    adapter.create_checkout.side_effect = ApiError(503, "PROVIDER_UNAVAILABLE", "lost")
    with Session(engine) as session:
        issue(session, actor, (int(trading["agency"]), int(trading["product"])), day=4)
        commit(session)
        online = use(session, actor, adapter)
        body = OnlinePaymentCreate(agencyId=trading["agency"], provider="CONTROLLED", amount="102")
        pending_key = uuid4()
        pending = online.create(body, pending_key)
        assert use(session, actor, None).create(body, pending_key).status == 202
        identifier = int(pending.body["id"])
        command = session.scalar(
            text("SELECT id FROM dms.api_idempotency WHERE result->'body'->>'id'=:id"),
            {"id": str(identifier)},
        )
        session.rollback()
        with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
            online.setup(identifier, command, report_errors=True)
        adapter.create_checkout.side_effect = None
        adapter.create_checkout.return_value = Checkout(
            checkoutUrl="https://controlled.test/a", expiresAt="2020-01-01T00:00:00Z"
        )
        with pytest.raises(ApiError, match="INVALID_PROVIDER_RESPONSE"):
            online.setup(identifier, command, report_errors=True)
        assert online.setup(identifier, command).status == 202
        failure = DBAPIError(None, None, Exception("synthetic"), connection_invalidated=True)
        row = online.repo.get(identifier)
        session.rollback()
        adapter.create_checkout.return_value = Checkout(
            checkoutUrl="https://controlled.test/a", expiresAt="2026-12-01T00:00:00Z"
        )
        with (
            patch.object(online.repo, "get", side_effect=[row, row, failure]),
            patch.object(session, "commit", side_effect=failure),
        ):
            with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
                online.setup(identifier, command)
        adapter.query_payment.return_value = VerifiedPayment(
            eventKey="pending",
            merchantReference=pending.body["merchantReference"],
            providerTransactionId="txn",
            amount="102",
            status="PENDING",
        )
        key = uuid4()
        assert online.reconcile(identifier, key).checkoutUrl == "https://controlled.test/a"
        assert online.reconcile(identifier, key).status == "PENDING"
        assert online.list().items
        session.rollback()
        # TX1 definite database rejection maps to a safe retryable503, not unknown commit.
        with patch.object(OnlinePaymentRepository, "create", side_effect=failure):
            with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
                online.create(body, uuid4())
        # A missing resource on reconcile is handled with transaction rollback.
        with pytest.raises(ApiError, match="NOT_FOUND"):
            online.reconcile(999999, uuid4())


def test_callback_success_wins_during_checkout_setup_without_mutating_terminal_payment(
    engine, actor, trading
):
    with Session(engine) as session:
        issue(session, actor, (int(trading["agency"]), int(trading["product"])), day=4)
        commit(session)
        adapter = Mock()

        def callback(reference, amount):
            with Session(engine) as callback_session:
                use(callback_session, actor, adapter).complete(
                    "CONTROLLED",
                    VerifiedPayment(
                        eventKey="early-callback",
                        merchantReference=reference,
                        providerTransactionId="txn-early",
                        amount="102",
                        status="SUCCESS",
                        paymentTime="2026-01-05T00:00:00Z",
                    ),
                )
            return Checkout(
                checkoutUrl="https://controlled.test/a", expiresAt="2026-12-01T00:00:00Z"
            )

        adapter.create_checkout.side_effect = ApiError(
            503, "PROVIDER_UNAVAILABLE", "lost first reply"
        )
        online = use(session, actor, adapter)
        pending = online.create(
            OnlinePaymentCreate(agencyId=trading["agency"], provider="CONTROLLED", amount="102"),
            uuid4(),
        )
        assert pending.status == 202
        adapter.query_payment.return_value = VerifiedPayment(
            eventKey="pending-query",
            merchantReference=pending.body["merchantReference"],
            providerTransactionId="txn-early",
            amount="102",
            status="PENDING",
        )
        adapter.create_checkout.side_effect = callback
        key = uuid4()
        result = online.reconcile(int(pending.body["id"]), key)
        assert result.status == "SUCCESS" and result.checkoutUrl is None
        assert online.reconcile(int(pending.body["id"]), key) == result
    with engine.connect() as check:
        assert (
            check.scalar(text("SELECT count(*) FROM dms.document WHERE kind='PAYMENT_RECEIPT'"))
            == 1
        )


def test_historical_pending_payment_without_setup_command_can_be_reconciled(engine, actor, trading):
    with Session(engine) as session:
        agency = int(trading["agency"])
        issue(session, actor, (agency, int(trading["product"])), day=4)
        commit(session)
        adapter = Mock()
        online = use(session, actor, adapter)
        from decimal import Decimal

        identifier = online.repo.create(agency, "CONTROLLED", Decimal(102), actor, uuid4(), 1800)
        row = online.repo.get(identifier)
        commit(session)
        adapter.query_payment.return_value = VerifiedPayment(
            eventKey="historical-query",
            merchantReference=row["merchantReference"],
            providerTransactionId="historical-txn",
            amount="102",
            status="PENDING",
        )
        result = online.reconcile(identifier, uuid4())
        assert result.status == "PENDING" and result.checkoutUrl is None
        adapter.create_checkout.assert_not_called()
