from unittest.mock import Mock
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.refunds.online import OnlineRefundService
from app.modules.refunds.schemas import ManualRefundConfirmation, RefundCreate, RefundUpdate
from app.modules.refunds.service import RefundService
from tests.integration.settlement_core.helpers import commit
from tests.integration.settlement_core.test_reservations import credit_cash

pytestmark = pytest.mark.integration


def test_source_bound_manual_reserved_payout_atomic_actual_vietnam_date(engine, actor, trading):
    agency, product = int(trading["agency"]), int(trading["product"])
    with Session(engine) as session:
        receipt, _ = credit_cash(session, actor, (agency, product), 100)
        commit(session)
        use = RefundService(session, CursorCodec(b"x" * 32), actor, "refund-test", lambda _: None)
        created = use.create(
            RefundCreate(
                originDocumentId=str(receipt),
                businessDate="2026-01-04",
                amount="60",
                paymentMethod="CASH",
            ),
            uuid4(),
        )
        identifier = int(created.body["id"])
        adapter = Mock()
        online = OnlineRefundService(
            session, use.codec, actor, "manual-not-online", lambda _: None, adapter
        )
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            online.request(identifier, Preconditions(created.headers["ETag"]), uuid4())
        adapter.request_refund.assert_not_called()
        assert created.body["agencyBalance"]["currentCredit"] == "100"
        updated = use.update(
            identifier, RefundUpdate(note="Payout"), Preconditions(created.headers["ETag"])
        )
        session.rollback()
        submitted = use.submit(identifier, Preconditions(use.etag(updated)), uuid4())
        assert submitted.body["status"] == "DRAFT"
        assert submitted.body["agencyBalance"]["reservedCredit"] == "60"
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            use.update(
                identifier, RefundUpdate(amount="59"), Preconditions(submitted.headers["ETag"])
            )
        paid = use.confirm_paid(
            identifier,
            ManualRefundConfirmation(paidAt="2026-01-05T18:00:00Z", evidenceReference="BANK-1"),
            Preconditions(submitted.headers["ETag"]),
            uuid4(),
        )
        assert paid.body["status"] == "POSTED" and paid.body["businessDate"] == "2026-01-06"
        assert paid.body["agencyBalance"]["currentCredit"] == "40"
        assert paid.body["agencyBalance"]["reservedCredit"] == "0"
    with engine.connect() as check:
        assert check.scalar(text("SELECT state FROM dms.refund_reservation")) == "CONSUMED"
        assert (
            check.scalar(text("SELECT sum(amount) FROM dms.credit_entry WHERE kind='REFUND'"))
            == -60
        )
