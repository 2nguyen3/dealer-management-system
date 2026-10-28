from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.credit_applications.schemas import (
    CreditApplicationCorrection,
    CreditApplicationCreate,
)
from app.modules.credit_applications.service import CreditApplicationService
from app.modules.document_corrections.credit import CreditCorrectionService
from app.modules.document_corrections.returns import ReturnCorrectionService
from app.modules.sales_returns.schemas import SalesReturnCorrection, SalesReturnCreate
from app.modules.stock_receipts.schemas import Reason
from tests.integration.catalogues.helpers import install_builders
from tests.integration.document_corrections.helpers import snapshot
from tests.integration.document_corrections.test_issues import use_case as issue_corrections
from tests.integration.document_corrections.test_return_credit import match, post_return, returns
from tests.integration.settlement_core.helpers import (
    commit,
    financial,
    issue,
    mark_posted,
    service,
)
from tests.integration.settlement_core.test_reservations import refund, reservations

pytestmark = pytest.mark.integration


def test_return_validation_failures_preserve_every_persisted_effect(engine, actor, trading):
    with Session(engine) as session:
        invoices = [issue(session, actor, trading, quantity=3) for _ in range(2)]
        commit(session)
        owner = returns(session, actor)
        lines = [
            owner.core.repo.lines(owner.core.repo.document(invoice)["currentRevisionId"])[0]["id"]
            for invoice in invoices
        ]
        identifier = post_return(owner, invoices[0], lines[0], "1", "2026-01-03")
        token = match(owner, identifier)
    before = snapshot(engine)
    for payload, code in (
        ([{"originLineId": str(lines[0]), "quantity": "1"}] * 2, "DUPLICATE_PRODUCT"),
        ([{"originLineId": str(lines[0]), "quantity": "0.5"}], "INVALID_QUANTITY"),
        ([{"originLineId": str(lines[1]), "quantity": "1"}], "RETURN_SOURCE_CONFLICT"),
        ([{"originLineId": "999999", "quantity": "1"}], "RETURN_SOURCE_CONFLICT"),
        ([{"originLineId": str(lines[0]), "quantity": "4"}], "RETURN_QUANTITY_CONFLICT"),
    ):
        with Session(engine) as session, pytest.raises(ApiError) as failure:
            ReturnCorrectionService(returns(session, actor)).correct(
                identifier,
                SalesReturnCorrection(
                    businessDate="2026-01-03", reason="Invalid replacement", lines=payload
                ),
                token,
                uuid4(),
            )
        assert failure.value.code == code
        assert snapshot(engine) == before
    with Session(engine) as session:
        owner = returns(session, actor)
        correction = ReturnCorrectionService(owner)
        cancelled = correction.cancel(identifier, Reason(reason="False return"), token, uuid4())
        after = snapshot(engine)
        with pytest.raises(ApiError) as failure:
            correction.cancel(
                identifier,
                Reason(reason="Already cancelled"),
                Preconditions(cancelled.headers["ETag"]),
                uuid4(),
            )
        assert failure.value.code == "STATE_CONFLICT"
        assert snapshot(engine) == after


def test_draft_return_can_cancel_after_origin_cancel_without_revision_or_ledgers(
    engine, actor, trading
):
    with Session(engine) as session:
        origin = issue(session, actor, trading)
        commit(session)
        owner = returns(session, actor)
        line = owner.core.repo.lines(owner.core.repo.document(origin)["currentRevisionId"])[0]
        draft = owner.create(
            SalesReturnCreate(
                originDocumentId=str(origin),
                businessDate="2026-01-03",
                lines=[{"originLineId": str(line["id"]), "quantity": "1"}],
            ),
            uuid4(),
        )
        identifier = int(draft.body["id"])
        changes = issue_corrections(session, actor)
        changes.cancel(origin, Reason(reason="False issue"), match(changes.owner, origin), uuid4())
        before = snapshot(engine)
        correction = ReturnCorrectionService(owner)
        with pytest.raises(ApiError) as failure:
            correction.correct(
                identifier,
                SalesReturnCorrection(
                    businessDate="2026-01-03",
                    reason="Draft is not posted",
                    lines=[{"originLineId": str(line["id"]), "quantity": "1"}],
                ),
                match(owner, identifier),
                uuid4(),
            )
        assert failure.value.code == "STATE_CONFLICT"
        assert snapshot(engine) == before
        token, key = match(owner, identifier), uuid4()
        reason = Reason(reason="Discard draft with cancelled origin")
        result = correction.cancel(identifier, reason, token, key)
        assert result.body["status"] == "CANCELLED" and result.body["inventoryChanges"] == []
        assert correction.cancel(identifier, reason, token, key) == result
    after = snapshot(engine)
    for table in (
        "document_revision",
        "document_line",
        "posting_batch",
        "inventory_entry",
        "receivable_entry",
        "credit_entry",
        "credit_lot",
        "agency_balance",
        "inventory_balance",
    ):
        assert after[table] == before[table]


@pytest.mark.parametrize("boundary", ["negative-history", "overflow"])
def test_return_stock_boundary_rejects_and_rolls_back_all_effects(engine, actor, trading, boundary):
    with Session(engine) as session:
        origin = issue(session, actor, trading, quantity=2)
        commit(session)
        owner = returns(session, actor)
        line = owner.core.repo.lines(owner.core.repo.document(origin)["currentRevisionId"])[0]
        identifier = post_return(
            owner, origin, line["id"], "2" if boundary == "negative-history" else "1", "2026-01-03"
        )
        install_builders(session, actor)
        session.execute(text("SET CONSTRAINTS ALL DEFERRED"))
        adjustment = session.scalar(
            text("""SELECT pg_temp.stock_draft('STOCK_ADJUSTMENT',NULL,DATE '2026-01-04',
            jsonb_build_array(jsonb_build_object('product',CAST(:product AS bigint),
              'quantity',CAST(:quantity AS numeric),'price',0)),gen_random_uuid())"""),
            {
                "product": trading[1],
                "quantity": "-1000" if boundary == "negative-history" else "999999999999000",
            },
        )
        session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": adjustment})
        if boundary == "negative-history":
            receipt = session.scalar(
                text("""SELECT pg_temp.stock_draft('STOCK_RECEIPT',NULL,DATE '2026-01-06',
                jsonb_build_array(jsonb_build_object('product',CAST(:product AS bigint),
                  'quantity',2,'price',100)),gen_random_uuid())"""),
                {"product": trading[1]},
            )
            session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": receipt})
        commit(session)
        assert session.scalar(text('SELECT "currentStock" FROM dms.inventory_balance')) > 0
        token = match(owner, identifier)
    before = snapshot(engine)
    with Session(engine) as session, pytest.raises(ApiError) as failure:
        ReturnCorrectionService(returns(session, actor)).correct(
            identifier,
            SalesReturnCorrection(
                businessDate="2026-01-03",
                reason="Invalid historical stock replacement",
                lines=[
                    {
                        "originLineId": str(line["id"]),
                        "quantity": "1" if boundary == "negative-history" else "2",
                    }
                ],
            ),
            token,
            uuid4(),
        )
    assert failure.value.code == (
        "STOCK_CONFLICT" if boundary == "negative-history" else "STOCK_OVERFLOW"
    )
    assert snapshot(engine) == before


@pytest.mark.parametrize("state", ["reserved", "paid"])
def test_return_correction_and_cancel_preserve_protected_original_cash(
    engine, actor, trading, state
):
    with Session(engine) as session:
        origin = issue(session, actor, trading, quantity=3)
        cash = financial(session, actor, trading[0], 306)
        service(session, actor).post_receipt(cash, uuid4())
        commit(session)
        owner = returns(session, actor)
        line = owner.core.repo.lines(owner.core.repo.document(origin)["currentRevisionId"])[0]
        identifier = post_return(owner, origin, line["id"], "2", "2026-01-04")
        requested = refund(session, actor, trading[0], cash, 150)
        reservations(session, actor).reserve(requested)
        commit(session)
        if state == "paid":
            mark_posted(session, actor, requested)
            reservations(session, actor).consume(requested, uuid4())
            commit(session)
        token = match(owner, identifier)
    before = snapshot(engine)
    for cancelling in (False, True):
        with Session(engine) as session, pytest.raises(ApiError) as failure:
            correction = ReturnCorrectionService(returns(session, actor))
            if cancelling:
                correction.cancel(
                    identifier, Reason(reason="Would erase cash source"), token, uuid4()
                )
            else:
                correction.correct(
                    identifier,
                    SalesReturnCorrection(
                        businessDate="2026-01-04",
                        reason="Would underfund protected cash",
                        lines=[{"originLineId": str(line["id"]), "quantity": "1"}],
                    ),
                    token,
                    uuid4(),
                )
        assert failure.value.code in ("CREDIT_RESERVED", "REFUND_SOURCE_CONFLICT")
        assert snapshot(engine) == before
    with Session(engine) as session:
        correction = ReturnCorrectionService(returns(session, actor))
        result = correction.correct(
            identifier,
            SalesReturnCorrection(
                businessDate="2026-01-04",
                reason="Valid increase retains protected source",
                lines=[{"originLineId": str(line["id"]), "quantity": "3"}],
            ),
            token,
            uuid4(),
        )
        assert result.body["totalAmount"] == "306"
    after = snapshot(engine)
    for table in ("credit_lot", "refund_reservation", "refund_attempt", "upfront_confirmation"):
        assert after[table] == before[table]


@pytest.mark.parametrize("state", ["reserved", "paid"])
def test_credit_replacement_cannot_spend_protected_return_credit(engine, actor, trading, state):
    with Session(engine) as session:
        origin = issue(session, actor, trading, quantity=3)
        cash = financial(session, actor, trading[0], 306)
        service(session, actor).post_receipt(cash, uuid4())
        commit(session)
        owner = returns(session, actor)
        line = owner.core.repo.lines(owner.core.repo.document(origin)["currentRevisionId"])[0]
        post_return(owner, origin, line["id"], "2", "2026-01-04")
        issue(session, actor, trading, quantity=3, day=4)
        commit(session)
        applications = CreditApplicationService(
            session, CursorCodec(b"x" * 32), actor, "credit-boundaries", lambda _: None
        )
        created = applications.create(
            CreditApplicationCreate(
                agencyId=str(trading[0]), businessDate="2026-01-05", amount="50"
            ),
            uuid4(),
        )
        identifier = int(created.body["id"])
        applications.post(identifier, Preconditions(created.headers["ETag"]), uuid4())
        requested = refund(session, actor, trading[0], cash, 150)
        reservations(session, actor).reserve(requested)
        commit(session)
        if state == "paid":
            mark_posted(session, actor, requested)
            reservations(session, actor).consume(requested, uuid4())
            commit(session)
        token = match(applications, identifier)
    before = snapshot(engine)
    for day, amount, code in (
        ("2026-01-05", "100", "INSUFFICIENT_CREDIT"),
        ("2026-01-02", "50", "PAYMENT_EXCEEDS_DEBT"),
        ("2025-12-31", "50", "AGENCY_CONFLICT"),
    ):
        with Session(engine) as session, pytest.raises(ApiError) as failure:
            owner = CreditApplicationService(
                session, CursorCodec(b"x" * 32), actor, "credit-boundaries", lambda _: None
            )
            CreditCorrectionService(owner).correct(
                identifier,
                CreditApplicationCorrection(
                    businessDate=day, amount=amount, reason="Invalid credit"
                ),
                token,
                uuid4(),
            )
        assert failure.value.code == code
        assert snapshot(engine) == before
