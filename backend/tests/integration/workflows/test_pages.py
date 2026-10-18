from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.payment_receipts.schemas import PaymentReceiptCreate
from app.modules.payment_receipts.service import PaymentReceiptService
from app.modules.receivables.service import ReceivableService
from app.modules.stock_issues.service import StockIssueService
from app.modules.upfront_payments.schemas import UpfrontCreate
from app.modules.upfront_payments.service import UpfrontPaymentService
from tests.integration.catalogues.helpers import agency
from tests.integration.workflows.test_races import ready_issue, service
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_all_read_filters_sort_pages_and_cursor_scopes(engine, actor, trading, client):
    with Session(engine) as s:
        issues = service(StockIssueService, s, actor)
        one = ready_issue(s, actor, trading, quantity="2")
        two = ready_issue(s, actor, trading, quantity="3", immediate="100")
        upfront = service(UpfrontPaymentService, s, actor)
        confirmation = upfront.verify(
            UpfrontCreate(
                issueRevisionId=two.body["revisionId"],
                amount="100",
                method="CASH",
                receivedAt="2026-01-02T02:00:00Z",
            ),
            uuid4(),
        )
        for item in (one, two):
            current = issues.get(int(item.body["id"]))
            issues.post(int(current.id), Preconditions(issues.etag(current)), uuid4())
        receipts = service(PaymentReceiptService, s, actor)
        payment = receipts.create(
            PaymentReceiptCreate(
                agencyId=trading["agency"],
                businessDate="2026-01-03",
                amount="100",
                paymentMethod="BANK_TRANSFER",
                note="Literal %_",
            ),
            uuid4(),
        )
        receipts.post(int(payment.body["id"]), Preconditions(payment.headers["ETag"]), uuid4())
        other_agency = agency(s)
        s.commit()
        reads = service(ReceivableService, s, actor)
        for field in ("agencyId", "currentDebt", "remainingCreditLimit"):
            for descending in ("", "-"):
                sort = descending + field
                first = reads.overview(limit=1, sort=sort)
                second = reads.overview(limit=1, sort=sort, cursor=first.pagination.nextCursor)
                assert first.pagination.hasMore and not second.pagination.hasMore
                assert first.items[0].agencyId != second.items[0].agencyId
                assert first.totals.currentDebt == second.totals.currentDebt == 310
        filtered = reads.overview(
            q="Agency",
            agencyId=trading["agency"],
            typeId=1,
            districtId=1,
            debtFrom=Decimal(310),
            debtTo=Decimal(310),
            status="ACTIVE",
        )
        assert len(filtered.items) == 1
        assert reads.overview(q="%_").items == []
        assert reads.overview(agencyId=str(other_agency)).totals.currentDebt == 0
        for field in ("id", "businessDate", "outstandingAmount"):
            for descending in ("", "-"):
                sort = descending + field
                first = reads.invoices(int(trading["agency"]), limit=1, sort=sort)
                second = reads.invoices(
                    int(trading["agency"]), limit=1, sort=sort, cursor=first.pagination.nextCursor
                )
                assert first.items[0].issueDocumentId != second.items[0].issueDocumentId
        assert (
            len(
                reads.invoices(
                    int(trading["agency"]),
                    code=one.body["code"],
                    settlementStatus="PARTIAL",
                    fromDate=date(2026, 1, 2),
                    toDate=date(2026, 1, 3),
                ).items
            )
            == 1
        )
        for sort in ("businessDate", "-businessDate"):
            page = reads.statement(int(trading["agency"]), limit=1, sort=sort)
            following = reads.statement(
                int(trading["agency"]), limit=1, sort=sort, cursor=page.pagination.nextCursor
            )
            assert page.items[0].id != following.items[0].id
            assert page.closingDebt == following.closingDebt == 310
        statement = reads.statement(
            int(trading["agency"]),
            fromDate=date(2026, 1, 3),
            toDate=date(2026, 1, 4),
            sourceDocumentId=payment.body["id"],
            issueDocumentId=one.body["id"],
            kind="PAYMENT",
            effectiveOnly=False,
        )
        assert (statement.openingDebt, statement.closingDebt) == (410, 310)
        assert len(statement.items) == 1
        assert reads.allocations(int(payment.body["id"])).items[0].issueDocumentId == one.body["id"]
        page = reads.overview(limit=1, sort="agencyId")
        invoice_page = reads.invoices(int(trading["agency"]), limit=1, sort="outstandingAmount")
        s.execute(text("UPDATE dms.agency SET name='Renamed' WHERE id=:id"), {"id": other_agency})
        s.commit()
        with pytest.raises(ApiError, match="INVALID_CURSOR"):
            reads.overview(limit=1, sort="currentDebt", cursor=page.pagination.nextCursor)
        s.execute(
            text(
                "UPDATE dms.agency SET status='TERMINATED',\"terminatedAt\"=clock_timestamp(),"
                "\"terminationReason\"='test' WHERE id=:id"
            ),
            {"id": other_agency},
        )
        s.commit()
        # A sort-boundary change invalidates the corresponding live anchor.
        last = receipts.create(
            PaymentReceiptCreate(
                agencyId=trading["agency"],
                businessDate="2026-01-04",
                amount="10",
                paymentMethod="CASH",
            ),
            uuid4(),
        )
        receipts.post(int(last.body["id"]), Preconditions(last.headers["ETag"]), uuid4())
        with pytest.raises(ApiError, match="INVALID_CURSOR"):
            reads.invoices(
                int(trading["agency"]),
                limit=1,
                sort="outstandingAmount",
                cursor=invoice_page.pagination.nextCursor,
            )
        assert (
            upfront.list(
                state="CONSUMED", agencyId=trading["agency"], issueDocumentId=two.body["id"]
            )
            .items[0]
            .id
            == confirmation.body["id"]
        )
        for cls in (StockIssueService, PaymentReceiptService):
            listed = service(cls, s, actor)
            for sort in listed.sorts:
                first = listed.list(limit=1, sort=sort)
                second = listed.list(limit=1, sort=sort, cursor=first.pagination.nextCursor)
                assert first.items[0].id != second.items[0].id
        assert len(receipts.list(q="%_").items) == 1
        assert (
            len(
                issues.list(
                    productId=trading["product"],
                    agencyId=trading["agency"],
                    settlementStatus="PARTIAL",
                ).items
            )
            == 2
        )
        s.rollback()
    for path, schema in (
        ("/api/v1/stock-issues", "DocumentListResponse"),
        ("/api/v1/payment-receipts", "DocumentListResponse"),
        ("/api/v1/upfront-confirmations", "UpfrontListResponse"),
    ):
        response = client.get(path)
        assert response.status_code == 200, response.text
        assert_schema(response.json(), schema)
