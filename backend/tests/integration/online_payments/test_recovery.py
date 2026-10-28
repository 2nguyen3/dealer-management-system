from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.core.exceptions import ApiError
from app.modules.online_payments.repository import OnlinePaymentRepository
from app.modules.online_payments.schemas import Checkout, OnlinePaymentCreate, VerifiedPayment
from app.modules.online_payments.service import OnlinePaymentService
from tests.integration.settlement_core.helpers import commit, issue

pytestmark = pytest.mark.integration


def use(session, actor, adapter):
    settings = SimpleNamespace(payment_provider="CONTROLLED", payment_expiry_seconds=1800)
    return OnlinePaymentService(
        session, CursorCodec(b"x" * 32), actor, "online-test", lambda _: None, settings, adapter
    )


def test_pending_committed_before_transport_and_same_key_restart_recovery(engine, actor, trading):
    agency, product = int(trading["agency"]), int(trading["product"])
    with Session(engine) as session:
        issue(session, actor, (agency, product), day=4)
        commit(session)

    def lost(reference, amount):
        with engine.connect() as check:
            assert (
                check.scalar(text("SELECT count(*) FROM dms.online_payment WHERE status='PENDING'"))
                == 1
            )
            assert check.scalar(text('SELECT "currentDebt" FROM dms.agency_balance')) == 102
        raise ApiError(503, "PROVIDER_UNAVAILABLE", "Lost reply")

    adapter = Mock(create_checkout=Mock(side_effect=lost))
    key = uuid4()
    body = OnlinePaymentCreate(agencyId=str(agency), provider="CONTROLLED", amount="102")
    with Session(engine) as session:
        original_create = OnlinePaymentRepository.create
        attempts = []

        def transient_insert(repo, *args, **kwargs):
            attempts.append(True)
            if len(attempts) < 3:
                raise DBAPIError(None, None, SimpleNamespace(sqlstate="40001"))
            return original_create(repo, *args, **kwargs)

        with patch.object(OnlinePaymentRepository, "create", new=transient_insert):
            pending = use(session, actor, adapter).create(body, key)
        assert len(attempts) == 3
        assert pending.status == 202 and pending.body["checkoutUrl"] is None
    reference = adapter.create_checkout.call_args.args[0]
    adapter.create_checkout.side_effect = None
    adapter.create_checkout.return_value = Checkout(
        checkoutUrl="https://controlled.test/checkout", expiresAt="2026-12-01T00:00:00Z"
    )
    with Session(engine) as session:
        recovered = use(session, actor, adapter).create(body, key)
        assert recovered.status == 201
        assert recovered.body["id"] == pending.body["id"]
        assert adapter.create_checkout.call_args.args[0] == reference
    with Session(engine) as session:
        restarted = use(session, actor, adapter)
        detail = restarted.get(int(pending.body["id"]))
        assert detail.checkoutUrl == "https://controlled.test/checkout"
        session.rollback()
        success = VerifiedPayment(
            eventKey="success-1",
            merchantReference=reference,
            providerTransactionId="transaction-1",
            amount="102",
            status="SUCCESS",
            paymentTime="2026-01-05T03:00:00Z",
        )
        completed, duplicate = restarted.complete("CONTROLLED", success)
        assert completed.status == "SUCCESS" and not duplicate
        repeated, duplicate = restarted.complete("CONTROLLED", success)
        assert repeated.receiptDocumentId == completed.receiptDocumentId and duplicate
    with engine.connect() as check:
        assert (
            check.scalar(text("SELECT count(*) FROM dms.document WHERE kind='PAYMENT_RECEIPT'"))
            == 1
        )
        assert check.scalar(text('SELECT "currentDebt" FROM dms.agency_balance')) == 0
