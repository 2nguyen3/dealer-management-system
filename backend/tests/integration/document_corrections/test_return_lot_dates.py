from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.modules.credit_applications.schemas import CreditApplicationCreate
from app.modules.credit_applications.service import CreditApplicationService
from app.modules.document_corrections.returns import ReturnCorrectionService
from app.modules.sales_returns.schemas import SalesReturnCorrection
from app.modules.settlement_core.repository import SettlementRepository
from tests.integration.document_corrections.test_return_credit import (
    match,
    post_return,
    returns,
)
from tests.integration.settlement_core.helpers import commit, financial, issue, service

pytestmark = pytest.mark.integration


@pytest.mark.parametrize(
    ("original_day", "corrected_day", "first_wins"),
    [(3, 5, False), (5, 3, True), (5, 4, True)],
    ids=["move-later", "move-earlier", "same-day-id-tie"],
)
def test_return_date_correction_reorders_existing_lots_without_rewriting_provenance(
    engine, actor, trading, original_day, corrected_day, first_wins
):
    agency = trading[0]
    with Session(engine) as session:
        invoices = [issue(session, actor, trading, day=1) for _ in range(2)]
        receipts = []
        for _ in invoices:
            receipt = financial(session, actor, agency, 102, day=2)
            service(session, actor).post_receipt(receipt, uuid4())
            receipts.append(receipt)
        commit(session)
        owner = returns(session, actor)
        source_lines = [
            owner.core.repo.lines(owner.core.repo.document(invoice)["currentRevisionId"])[0]["id"]
            for invoice in invoices
        ]
        first = post_return(owner, invoices[0], source_lines[0], "1", date(2026, 1, original_day))
        post_return(owner, invoices[1], source_lines[1], "1", "2026-01-04")
        original_revision = owner.core.repo.document(first)["currentRevisionId"]
        lots_before = session.execute(text("SELECT * FROM dms.credit_lot ORDER BY id")).all()
        repo = SettlementRepository(session)
        original_lots = {lot.key.receipt_id: lot for lot in repo.lots(agency)}
        first_lot, second_lot = (original_lots[receipt].key.id for receipt in receipts)
        issue(session, actor, trading, day=6)
        commit(session)
        applications = CreditApplicationService(
            session, CursorCodec(b"x" * 32), actor, "return-lot-date", lambda _: None
        )
        created = applications.create(
            CreditApplicationCreate(agencyId=str(agency), businessDate="2026-01-07", amount="50"),
            uuid4(),
        )
        application = int(created.body["id"])
        applications.post(application, Preconditions(created.headers["ETag"]), uuid4())
        before_offset = repo.effective(repo.source(application)["revisionId"], "credit")
        assert [(row["lotId"], row["amount"]) for row in before_offset] == [
            (first_lot if original_day < 4 else second_lot, Decimal(-50))
        ]

        ReturnCorrectionService(owner).correct(
            first,
            SalesReturnCorrection(
                businessDate=date(2026, 1, corrected_day),
                reason="Correct the recorded return date",
                lines=[{"originLineId": str(source_lines[0]), "quantity": "1"}],
            ),
            match(owner, first),
            uuid4(),
        )

    # A fresh connection checks the committed result, not in-memory replay inputs.
    with Session(engine) as session:
        repo = SettlementRepository(session)
        assert (
            session.execute(text("SELECT * FROM dms.credit_lot ORDER BY id")).all() == lots_before
        )
        current_revision = returns(session, actor).core.repo.document(first)["currentRevisionId"]
        assert current_revision != original_revision
        lots = {lot.key.id: lot for lot in repo.lots(agency)}
        assert lots[first_lot].key.revision_id == current_revision
        assert lots[first_lot].key.receipt_id == receipts[0]
        assert lots[first_lot].business_date == date(2026, 1, corrected_day)
        assert lots[second_lot].business_date == date(2026, 1, 4)
        assert [lot.key.id for lot in lots.values()] == (
            [first_lot, second_lot] if first_wins else [second_lot, first_lot]
        )
        wanted_lot = first_lot if first_wins else second_lot
        offsets = repo.effective(repo.source(application)["revisionId"], "credit")
        assert [(row["lotId"], row["amount"]) for row in offsets] == [(wanted_lot, Decimal(-50))]
        available = repo.available(agency)
        assert [row["id"] for row in available] == (
            [first_lot, second_lot] if first_wins else [second_lot, first_lot]
        )
        by_lot = {row["id"]: row for row in available}
        assert by_lot[first_lot]["sourceRevisionId"] == original_revision
        assert by_lot[first_lot]["businessDate"] == date(2026, 1, corrected_day)
        assert by_lot[first_lot]["originReceiptId"] == receipts[0]
        assert by_lot[wanted_lot]["available"] == 52
        assert repo.available(agency, receipt_id=receipts[0]) == [by_lot[first_lot]]
        assert repo.available(agency, receipt_id=999999) == []
