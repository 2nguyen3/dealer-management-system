from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from threading import Event
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.document_core.schemas import DraftLine
from app.modules.payment_receipts.schemas import PaymentReceiptCreate
from app.modules.payment_receipts.service import PaymentReceiptService
from app.modules.receivables.service import ReceivableService
from app.modules.stock_issues.schemas import StockIssueCreate
from app.modules.stock_issues.service import StockIssueService
from tests.integration.catalogues.helpers import agency, product
from tests.integration.workflows.test_races import service

pytestmark = pytest.mark.integration


def test_zero_rounded_total_terminated_agency_and_changed_overview_anchor(engine, actor, trading):
    with Session(engine) as s:
        unit = s.scalar(
            text(
                'INSERT INTO dms.unit (code,name,"allowsFraction") '
                "VALUES ('FRAC','Fraction',true) RETURNING id"
            )
        )
        fractional = product(s, unit)
        s.commit()
        from app.modules.stock_receipts.schemas import StockReceiptCreate
        from app.modules.stock_receipts.service import StockReceiptService

        stock = service(StockReceiptService, s, actor)
        incoming = stock.create(
            StockReceiptCreate(
                businessDate="2026-01-01",
                lines=[{"productId": str(fractional), "quantity": "10", "unitPrice": "1"}],
            ),
            uuid4(),
        )
        stock.post(int(incoming.body["id"]), Preconditions(incoming.headers["ETag"]), uuid4())
        issues = service(StockIssueService, s, actor)
        zero = issues.create(
            StockIssueCreate(
                agencyId=trading["agency"],
                businessDate="2026-01-02",
                lines=[{"productId": str(fractional), "quantity": "0.001"}],
            ),
            uuid4(),
        )
        with pytest.raises(ApiError, match="INVALID_TOTAL"):
            issues.submit(int(zero.body["id"]), Preconditions(zero.headers["ETag"]), uuid4())
        other = agency(s)
        s.commit()
        reads = service(ReceivableService, s, actor)
        page = reads.overview(limit=1, sort="agencyId", status="ACTIVE")
        s.execute(
            text(
                "UPDATE dms.agency SET status='TERMINATED',\"terminatedAt\"=clock_timestamp(),"
                "\"terminationReason\"='Test' WHERE id=:id"
            ),
            {"id": int(page.items[0].agencyId)},
        )
        s.commit()
        with pytest.raises(ApiError, match="INVALID_CURSOR"):
            reads.overview(
                limit=1, sort="agencyId", status="ACTIVE", cursor=page.pagination.nextCursor
            )
        with pytest.raises(ApiError, match="AGENCY_CONFLICT"):
            issues.create(
                StockIssueCreate(agencyId=trading["agency"], businessDate="2026-01-02"), uuid4()
            )
        assert reads.balance(other).currentDebt == 0
        s.rollback()


def test_submit_detects_line_dependency_change_and_retries_with_stale_etag(engine, actor, trading):
    with Session(engine) as s:
        issues = service(StockIssueService, s, actor)
        created = issues.create(
            StockIssueCreate(
                agencyId=trading["agency"],
                businessDate="2026-01-02",
                lines=[{"productId": trading["product"], "quantity": "1"}],
            ),
            uuid4(),
        )
        other = product(s, trading["unit"])
        s.commit()
    discovered, proceed = Event(), Event()
    result = Queue()

    def submit():
        with Session(engine) as s:
            issues = service(StockIssueService, s, actor)
            original = issues.core.repo.product_ids
            calls = 0

            def ids(identifier):
                nonlocal calls
                values = original(identifier)
                calls += 1
                if calls == 1:
                    discovered.set()
                    assert proceed.wait(60)
                return values

            from unittest.mock import patch

            with patch.object(issues.core.repo, "product_ids", side_effect=ids):
                try:
                    issues.submit(
                        int(created.body["id"]), Preconditions(created.headers["ETag"]), uuid4()
                    )
                except ApiError as error:
                    result.put(error.code)

    with ThreadPoolExecutor(1) as pool:
        future = pool.submit(submit)
        assert discovered.wait(30)
        try:
            with Session(engine) as s:
                issues = service(StockIssueService, s, actor)
                issues.core.create_line(
                    int(created.body["id"]),
                    1,
                    DraftLine(
                        kind="STOCK_ISSUE",
                        productId=str(other),
                        quantity="1",
                        unitPrice="1",
                        basePurchasePrice="1",
                    ),
                    Preconditions(created.headers["ETag"]),
                )
                s.commit()
        finally:
            proceed.set()
        future.result(timeout=90)
    assert result.get(timeout=1) == "PRECONDITION_FAILED"
    with engine.connect() as c:
        assert (
            c.scalar(
                text('SELECT count(*) FROM dms.document_line WHERE "revisionId"=:id'),
                {"id": int(created.body["revisionId"])},
            )
            == 2
        )


def test_backdated_receipt_reassigns_later_allocations_append_only(engine, actor, trading):
    with Session(engine) as s:
        issues = service(StockIssueService, s, actor)

        def sold(day):
            draft = issues.create(
                StockIssueCreate(
                    agencyId=trading["agency"],
                    businessDate=day,
                    lines=[{"productId": trading["product"], "quantity": "1"}],
                ),
                uuid4(),
            )
            ready = issues.submit(
                int(draft.body["id"]), Preconditions(draft.headers["ETag"]), uuid4()
            )
            return issues.post(int(draft.body["id"]), Preconditions(ready.headers["ETag"]), uuid4())

        first = sold("2026-01-02")
        second = sold("2026-01-05")
        receipts = service(PaymentReceiptService, s, actor)

        def collected(day):
            created = receipts.create(
                PaymentReceiptCreate(
                    agencyId=trading["agency"], businessDate=day, amount="102", paymentMethod="CASH"
                ),
                uuid4(),
            )
            return receipts.post(
                int(created.body["id"]), Preconditions(created.headers["ETag"]), uuid4()
            )

        late = collected("2026-01-06")
        reads = service(ReceivableService, s, actor)
        assert reads.allocations(int(late.body["id"])).items[0].issueDocumentId == first.body["id"]
        early = collected("2026-01-03")
        assert reads.allocations(int(late.body["id"])).items[0].issueDocumentId == second.body["id"]
        assert reads.allocations(int(early.body["id"])).items[0].issueDocumentId == first.body["id"]
        history = reads.allocations(int(late.body["id"]), effectiveOnly=False)
        assert len(history.items) == 3 and sum(row.amountDelta for row in history.items) == -102
        assert reads.balance(int(trading["agency"])).currentDebt == 0
        s.rollback()
