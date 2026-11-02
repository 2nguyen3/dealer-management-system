from datetime import date
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.refunds.schemas import ManualRefundConfirmation, RefundCreate, RefundUpdate
from app.modules.refunds.service import RefundService
from app.modules.settlement_core.reservations import ReservationService
from app.modules.stock_receipts.schemas import Reason
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.credit_applications.test_service import (
    create as application,
)
from tests.integration.credit_applications.test_service import (
    service as credit_service,
)
from tests.integration.settlement_core.helpers import commit, issue
from tests.integration.settlement_core.test_reservations import credit_cash

pytestmark = pytest.mark.integration


def use(session, actor):
    return RefundService(session, CursorCodec(b"x" * 32), actor, "refund-guards", lambda _: None)


@pytest.mark.parametrize("winner", ["paid", "cancel"])
def test_manual_confirmation_and_cancel_both_lock_winners(engine, actor, trading, winner):
    with Session(engine) as session:
        receipt, _ = credit_cash(
            session, actor, (int(trading["agency"]), int(trading["product"])), 100
        )
        commit(session)
        service = use(session, actor)
        draft = service.create(
            RefundCreate(
                originDocumentId=str(receipt),
                businessDate="2026-01-04",
                amount="60",
                paymentMethod="CASH",
            ),
            uuid4(),
        )
        identifier = int(draft.body["id"])
        ready = service.submit(identifier, Preconditions(draft.headers["ETag"]), uuid4())

    def paid(session):
        return (
            use(session, actor)
            .confirm_paid(
                identifier,
                ManualRefundConfirmation(paidAt="2026-01-05T00:00:00Z", evidenceReference="cash"),
                Preconditions(ready.headers["ETag"]),
                uuid4(),
            )
            .body["status"]
        )

    def cancel(session):
        return (
            use(session, actor)
            .cancel(
                identifier,
                Reason(reason="No payout"),
                Preconditions(ready.headers["ETag"]),
                uuid4(),
            )
            .body["status"]
        )

    first, second = ordered_race(
        engine, paid if winner == "paid" else cancel, cancel if winner == "paid" else paid
    )
    assert (
        first == ("POSTED" if winner == "paid" else "CANCELLED") and second == "PRECONDITION_FAILED"
    )
    with engine.connect() as check:
        assert check.scalar(text('SELECT "currentCredit" FROM dms.agency_balance')) == (
            40 if winner == "paid" else 100
        )
        assert check.scalar(text("SELECT state FROM dms.refund_reservation")) == (
            "CONSUMED" if winner == "paid" else "RELEASED"
        )


def test_manual_boundaries_source_limits_and_mid_post_rollback(engine, actor, trading):
    with Session(engine) as session:
        receipt, _ = credit_cash(
            session, actor, (int(trading["agency"]), int(trading["product"])), 100
        )
        commit(session)
        service = use(session, actor)
        with pytest.raises(ApiError, match="REFUND_SOURCE_CONFLICT"):
            service.create(
                RefundCreate(
                    originDocumentId=str(receipt),
                    businessDate="2026-01-04",
                    amount="1",
                    paymentMethod="ONLINE",
                ),
                uuid4(),
            )
        body = RefundCreate(
            originDocumentId=str(receipt),
            businessDate="2026-01-04",
            amount="101",
            paymentMethod="BANK_TRANSFER",
        )
        with pytest.raises(ApiError, match="REFUND_SOURCE_CONFLICT"):
            service.create(body.model_copy(update={"businessDate": date(2026, 1, 2)}), uuid4())
        draft = service.create(body, uuid4())
        identifier = int(draft.body["id"])
        with pytest.raises(ApiError, match="REFUND_SOURCE_CONFLICT"):
            service.update(
                identifier,
                RefundUpdate(businessDate="2026-01-02"),
                Preconditions(draft.headers["ETag"]),
            )
        with pytest.raises(ApiError, match="INSUFFICIENT_CREDIT"):
            service.submit(identifier, Preconditions(draft.headers["ETag"]), uuid4())
        updated = service.update(
            identifier,
            RefundUpdate(amount="100", reason="Actual refund"),
            Preconditions(draft.headers["ETag"]),
        )
        token = service.etag(updated)
        session.rollback()
        ready = service.submit(identifier, Preconditions(token), uuid4())
        confirm = ManualRefundConfirmation(
            paidAt="2026-01-05T00:00:00Z", evidenceReference="bank-1"
        )
        with pytest.raises(ApiError, match="REFUND_SOURCE_CONFLICT"):
            service.confirm_paid(
                identifier,
                ManualRefundConfirmation(
                    paidAt="2026-01-02T00:00:00Z", evidenceReference="too-early"
                ),
                Preconditions(ready.headers["ETag"]),
                uuid4(),
            )
        with patch.object(ReservationService, "consume", side_effect=RuntimeError("mid-consume")):
            with pytest.raises(RuntimeError, match="mid-consume"):
                service.confirm_paid(
                    identifier, confirm, Preconditions(ready.headers["ETag"]), uuid4()
                )
        with engine.connect() as check:
            assert (
                check.scalar(text("SELECT status FROM dms.document WHERE kind='REFUND'")) == "DRAFT"
            )
            assert check.scalar(text("SELECT state FROM dms.refund_reservation")) == "ACTIVE"
            assert (
                check.scalar(text("SELECT count(*) FROM dms.credit_entry WHERE kind='REFUND'")) == 0
            )
        paid = service.confirm_paid(
            identifier, confirm, Preconditions(ready.headers["ETag"]), uuid4()
        )
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            service.cancel(
                identifier,
                Reason(reason="Cannot erase cash"),
                Preconditions(paid.headers["ETag"]),
                uuid4(),
            )


@pytest.mark.parametrize("winner", ["refund", "application"])
def test_actual_submit_and_application_race_protect_same_cash_source(
    engine, actor, trading, winner
):
    agency, product = int(trading["agency"]), int(trading["product"])
    with Session(engine) as session:
        receipt, _ = credit_cash(session, actor, (agency, product), 100)
        issue(session, actor, (agency, product), day=4)
        commit(session)
        refund = use(session, actor).create(
            RefundCreate(
                originDocumentId=str(receipt),
                businessDate="2026-01-05",
                amount="100",
                paymentMethod="CASH",
            ),
            uuid4(),
        )
        credit = application(credit_service(session, actor), agency, "100", "2026-01-05")

    def reserve(session):
        return (
            use(session, actor)
            .submit(int(refund.body["id"]), Preconditions(refund.headers["ETag"]), uuid4())
            .body["agencyBalance"]["reservedCredit"]
        )

    def apply(session):
        return (
            credit_service(session, actor)
            .post(int(credit.body["id"]), Preconditions(credit.headers["ETag"]), uuid4())
            .body["agencyBalance"]["currentCredit"]
        )

    first, second = (
        ordered_race(engine, reserve, apply)
        if winner == "refund"
        else ordered_race(engine, apply, reserve)
    )
    assert first == ("100" if winner == "refund" else "0") and second == "INSUFFICIENT_CREDIT"
    with engine.connect() as check:
        assert check.scalar(text('SELECT "currentCredit" FROM dms.agency_balance')) == (
            100 if winner == "refund" else 0
        )
        assert check.scalar(
            text("SELECT coalesce(sum(amount),0) FROM dms.refund_reservation WHERE state='ACTIVE'")
        ) == (100 if winner == "refund" else 0)
