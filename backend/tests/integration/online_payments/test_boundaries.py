from datetime import UTC, datetime
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


def test_provider_errors_filters_pending_reconcile_and_conflicting_events(engine, actor, trading):
    agency, product = int(trading["agency"]), int(trading["product"])
    adapter = Mock()
    adapter.create_checkout.return_value = Checkout(
        checkoutUrl="https://controlled.test/a", expiresAt="2026-12-01T00:00:00Z"
    )
    with Session(engine) as session:
        issue(session, actor, (agency, product), day=4)
        commit(session)
        online = use(session, actor, adapter)
        body = OnlinePaymentCreate(agencyId=str(agency), provider="CONTROLLED", amount="103")
        with pytest.raises(ApiError, match="PAYMENT_EXCEEDS_DEBT"):
            online.create(body, uuid4())
        body = body.model_copy(update={"amount": body.amount - 1})
        key = uuid4()
        created = online.create(body, key)
        assert online.create(body, key).body["id"] == created.body["id"]
        identifier = int(created.body["id"])
        reference = created.body["merchantReference"]
        evidence = VerifiedPayment(
            eventKey="pending",
            merchantReference=reference,
            providerTransactionId="txn",
            amount="102",
            status="PENDING",
        )
        adapter.query_payment.return_value = evidence
        assert online.reconcile(identifier, uuid4()).status == "PENDING"
        with pytest.raises(ApiError, match="PAYMENT_CONFLICT"):
            online.complete("CONTROLLED", evidence.model_copy(update={"status": "FAILED"}))
        with pytest.raises(ApiError, match="PAYMENT_CONFLICT"):
            online.complete(
                "CONTROLLED",
                evidence.model_copy(
                    update={"eventKey": "other", "providerTransactionId": "different"}
                ),
            )
        day = datetime.now(UTC)
        assert online.list(
            provider="CONTROLLED",
            merchantReference=reference,
            providerTransactionId="txn",
            status="PENDING",
            createdFrom=day.replace(year=2020),
            createdTo=day.replace(year=2030),
        ).items[0].id == str(identifier)
        assert online.events(identifier).items[0].eventKey == "pending"
        for filters in ({"sort": "invalid"}, {"createdFrom": day, "createdTo": day}):
            with pytest.raises(ApiError, match="VALIDATION_FAILED"):
                online.list(**filters)
        with pytest.raises(ValueError, match="Invalid online filter"):
            online.list(invalid="unsafe")
        adapter.query_payment.return_value = evidence.model_copy(
            update={"merchantReference": "wrong"}
        )
        session.rollback()
        with pytest.raises(ApiError, match="INVALID_PROVIDER_RESPONSE"):
            online.reconcile(identifier, uuid4())
        unavailable = use(session, actor, None)
        with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
            unavailable.reconcile(identifier, uuid4())
        failure = DBAPIError(None, None, Exception("synthetic-error"), connection_invalidated=True)
        with patch.object(OnlinePaymentRepository, "reference", side_effect=failure):
            with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
                online.complete("CONTROLLED", evidence)
        with patch.object(OnlinePaymentRepository, "get", side_effect=failure):
            with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
                online.setup(identifier, uuid4())
            with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
                online.reconcile(identifier, uuid4())
    with engine.connect() as check:
        assert check.scalar(text("SELECT count(*) FROM dms.payment_event")) == 1
