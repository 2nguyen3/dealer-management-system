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
from app.modules.stock_issues.schemas import StockIssueCreate
from app.modules.stock_issues.service import StockIssueService
from app.modules.stock_receipts.schemas import StockReceiptCreate
from app.modules.stock_receipts.service import StockReceiptService
from tests.integration.workflows.helpers import state
from tests.integration.workflows.test_races import service
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_historical_debt_exceeds_stored_money_and_overflow_is_a_business_conflict(
    engine, actor, trading
):
    with Session(engine) as s:
        s.execute(text('UPDATE dms.agency_type SET "maxDebt"=999999999999999999 WHERE id=1'))
        s.execute(text('UPDATE dms.business_rule SET "sellingPriceRate"=1'))
        s.commit()
        stock = service(StockReceiptService, s, actor)
        incoming = stock.create(
            StockReceiptCreate(
                businessDate="2026-01-01",
                lines=[
                    {
                        "productId": trading["product"],
                        "quantity": "1",
                        "unitPrice": "600000000000000000",
                    }
                ],
            ),
            uuid4(),
        )
        stock.post(int(incoming.body["id"]), Preconditions(incoming.headers["ETag"]), uuid4())
        issues = service(StockIssueService, s, actor)

        def prepared(day):
            draft = issues.create(
                StockIssueCreate(
                    agencyId=trading["agency"],
                    businessDate=day,
                    lines=[{"productId": trading["product"], "quantity": "1"}],
                ),
                uuid4(),
            )
            return issues.submit(
                int(draft.body["id"]), Preconditions(draft.headers["ETag"]), uuid4()
            )

        first = prepared("2026-01-02")
        competing = prepared("2026-01-03")
        issues.post(int(first.body["id"]), Preconditions(first.headers["ETag"]), uuid4())
        before = state(engine)
        with pytest.raises(ApiError, match="BALANCE_OVERFLOW"):
            issues.post(
                int(competing.body["id"]), Preconditions(competing.headers["ETag"]), uuid4()
            )
        assert state(engine) == before
        receipts = service(PaymentReceiptService, s, actor)
        payment = receipts.create(
            PaymentReceiptCreate(
                agencyId=trading["agency"],
                businessDate="2026-01-05",
                amount="500000000000000000",
                paymentMethod="CASH",
            ),
            uuid4(),
        )
        receipts.post(int(payment.body["id"]), Preconditions(payment.headers["ETag"]), uuid4())
        issues.post(int(competing.body["id"]), Preconditions(competing.headers["ETag"]), uuid4())
        reads = service(ReceivableService, s, actor)
        statement = reads.statement(
            int(trading["agency"]), fromDate=date(2026, 1, 4), toDate=date(2026, 1, 5)
        )
        assert statement.openingDebt == statement.closingDebt == Decimal("1200000000000000000")
        assert_schema(statement.model_dump(mode="json"), "ReceivableStatement")
        full = reads.statement(int(trading["agency"]))
        assert full.closingDebt == Decimal("700000000000000000")
        assert max(row.balanceAfter for row in full.items) == Decimal("1200000000000000000")
        s.rollback()


def test_submit_repricing_checks_line_and_total_overflow_before_database_write(
    engine, actor, trading
):
    with Session(engine) as s:
        s.execute(text('UPDATE dms.agency_type SET "maxDebt"=999999999999999999 WHERE id=1'))
        s.execute(text('UPDATE dms.business_rule SET "sellingPriceRate"=1'))
        s.commit()
        stock = service(StockReceiptService, s, actor)
        incoming = stock.create(
            StockReceiptCreate(
                businessDate="2026-01-01",
                lines=[
                    {
                        "productId": trading["product"],
                        "quantity": "1",
                        "unitPrice": "400000000000000000",
                    }
                ],
            ),
            uuid4(),
        )
        stock.post(int(incoming.body["id"]), Preconditions(incoming.headers["ETag"]), uuid4())
        issues = service(StockIssueService, s, actor)
        draft = issues.create(
            StockIssueCreate(
                agencyId=trading["agency"],
                businessDate="2026-01-02",
                lines=[{"productId": trading["product"], "quantity": "2"}],
            ),
            uuid4(),
        )
        s.execute(text('UPDATE dms.business_rule SET "sellingPriceRate"=1.5'))
        s.commit()
        before = state(engine)
        with pytest.raises(ApiError, match="TOTAL_OVERFLOW") as failure:
            issues.submit(int(draft.body["id"]), Preconditions(draft.headers["ETag"]), uuid4())
        assert failure.value.status == 409
        assert state(engine) == before
        assert issues.get(int(draft.body["id"])).currentRevision.lines[0].unitPrice == Decimal(
            "400000000000000000"
        )
        s.rollback()
