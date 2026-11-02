from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.credit_applications.schemas import CreditApplicationCorrection
from app.modules.document_corrections.credit import CreditCorrectionService
from app.modules.document_corrections.returns import ReturnCorrectionService
from app.modules.sales_returns.schemas import SalesReturnCorrection
from app.modules.stock_receipts.schemas import Reason
from tests.integration.document_corrections.helpers import snapshot
from tests.integration.document_corrections.test_financial_races import applications
from tests.integration.document_corrections.test_issues import ready_with_money, replacement
from tests.integration.document_corrections.test_issues import use_case as issue_corrections
from tests.integration.document_corrections.test_return_credit import match, post_return, returns
from tests.integration.settlement_core.helpers import commit, financial, issue, service
from tests.integration.settlement_core.test_reservations import credit_cash

pytestmark = pytest.mark.integration


def periods(**days):
    return {
        date(2026, 1, int(day.removeprefix("d"))): Decimal(amount) for day, amount in days.items()
    }


def period_oracle(engine, trading, debt, credit, stock):
    """Reconcile current sources, all persisted reversal legs and caches independently."""
    agency, product = trading
    with engine.connect() as connection:
        ledgers = {}
        for ledger, expected in (("receivable", debt), ("credit", credit)):
            ledgers[ledger] = dict(
                connection.execute(
                    text(f"""
                SELECT "businessDate",sum(amount) FROM dms.{ledger}_entry
                WHERE "agencyId"=:agency GROUP BY "businessDate" HAVING sum(amount)<>0
            """),
                    {"agency": agency},
                ).all()
            )
            assert ledgers[ledger] == expected
        sources = dict(
            connection.execute(
                text("""
            SELECT r."businessDate",sum(CASE d.kind
              WHEN 'STOCK_ISSUE' THEN r."totalAmount"
              WHEN 'PAYMENT_RECEIPT' THEN -r."totalAmount"
              WHEN 'SALES_RETURN' THEN -r."totalAmount"
              WHEN 'REFUND' THEN r."totalAmount" ELSE 0 END)
            FROM dms.document d JOIN dms.document_revision r ON r.id=d."currentRevisionId"
            WHERE d."agencyId"=:agency AND d.status='POSTED'
            GROUP BY r."businessDate"
        """),
                {"agency": agency},
            ).all()
        )
        net = {day: debt.get(day, 0) - credit.get(day, 0) for day in debt.keys() | credit.keys()}
        assert {day: value for day, value in sources.items() if value} == {
            day: value for day, value in net.items() if value
        }
        actual_stock = dict(
            connection.execute(
                text("""
            SELECT "businessDate",sum(quantity) FROM dms.inventory_entry
            WHERE "productId"=:product GROUP BY "businessDate" HAVING sum(quantity)<>0
        """),
                {"product": product},
            ).all()
        )
        assert actual_stock == stock
        source_stock = dict(
            connection.execute(
                text("""
            SELECT r."businessDate",sum(CASE WHEN d.kind='STOCK_ISSUE'
              THEN -l.quantity ELSE l.quantity END)
            FROM dms.document d JOIN dms.document_revision r ON r.id=d."currentRevisionId"
            JOIN dms.document_line l ON l."revisionId"=r.id
            WHERE d.status='POSTED' AND l."productId"=:product
            GROUP BY r."businessDate"
        """),
                {"product": product},
            ).all()
        )
        assert {day: value for day, value in source_stock.items() if value} == stock
        balance = connection.execute(
            text("""
            SELECT "currentDebt","currentCredit" FROM dms.agency_balance WHERE "agencyId"=:agency
        """),
            {"agency": agency},
        ).one()
        assert balance == (sum(debt.values(), Decimal(0)), sum(credit.values(), Decimal(0)))
        assert connection.scalar(
            text('SELECT "currentStock" FROM dms.inventory_balance WHERE "productId"=:product'),
            {"product": product},
        ) == sum(stock.values(), Decimal(0))


def assert_original_rows_preserved(before, after):
    for table in ("document_revision", "document_line", "credit_lot"):
        originals = {row["id"]: row for row in before[table]}
        assert {row["id"]: row for row in after[table] if row["id"] in originals} == originals


def test_issue_and_auto_receipt_move_then_cancel_restate_original_periods(engine, actor, trading):
    identifier = ready_with_money(engine, actor, trading, posted=True)
    before = snapshot(engine)
    period_oracle(engine, trading, periods(d2=266), {}, periods(d1=1000, d2=-3))
    with Session(engine) as session:
        correction = issue_corrections(session, actor)
        correction.correct(
            identifier,
            replacement(trading[1], "2", businessDate="2026-02-06"),
            match(correction.owner, identifier),
            uuid4(),
        )
    period_oracle(
        engine,
        trading,
        {date(2026, 2, 6): Decimal(164)},
        {},
        periods(d1=1000) | {date(2026, 2, 6): Decimal(-2)},
    )
    with Session(engine) as session:
        correction = issue_corrections(session, actor)
        result = correction.cancel(
            identifier, Reason(reason="No delivery"), match(correction.owner, identifier), uuid4()
        )
    assert result.body["separateReceiptId"] is not None
    period_oracle(engine, trading, {}, periods(d2=40), periods(d1=1000))
    assert_original_rows_preserved(before, snapshot(engine))


def test_paid_return_move_then_cancel_restate_stock_and_credit_periods(engine, actor, trading):
    with Session(engine) as session:
        origin = issue(session, actor, trading, quantity=3)
        cash = financial(session, actor, trading[0], 306)
        service(session, actor).post_receipt(cash, uuid4())
        commit(session)
        owner = returns(session, actor)
        line = owner.core.repo.lines(owner.core.repo.document(origin)["currentRevisionId"])[0]
        identifier = post_return(owner, origin, line["id"], "2", "2026-01-04")
    before = snapshot(engine)
    debt = periods(d2=306, d3=-306)
    period_oracle(engine, trading, debt, periods(d4=204), periods(d1=1000, d2=-3, d4=2))
    with Session(engine) as session:
        owner = returns(session, actor)
        ReturnCorrectionService(owner).correct(
            identifier,
            SalesReturnCorrection(
                businessDate="2026-02-07",
                reason="Wrong date and quantity",
                lines=[{"originLineId": str(line["id"]), "quantity": "1"}],
            ),
            match(owner, identifier),
            uuid4(),
        )
    period_oracle(
        engine,
        trading,
        debt,
        {date(2026, 2, 7): Decimal(102)},
        periods(d1=1000, d2=-3) | {date(2026, 2, 7): Decimal(1)},
    )
    with Session(engine) as session:
        owner = returns(session, actor)
        ReturnCorrectionService(owner).cancel(
            identifier, Reason(reason="False return"), match(owner, identifier), uuid4()
        )
    period_oracle(engine, trading, debt, {}, periods(d1=1000, d2=-3))
    after = snapshot(engine)
    assert after["credit_lot"] == before["credit_lot"]
    assert_original_rows_preserved(before, after)


def test_credit_move_then_cancel_restate_offset_period_without_new_cash(engine, actor, trading):
    with Session(engine) as session:
        credit_cash(session, actor, trading, 100)
        issue(session, actor, trading, quantity=3, day=4)
        identifier = financial(
            session,
            actor,
            trading[0],
            60,
            day=5,
            kind="CREDIT_APPLICATION",
            receipt=None,
            method=None,
        )
        commit(session)
        owner = applications(session, actor)
        owner.post(identifier, match(owner, identifier), uuid4())
    before = snapshot(engine)
    stock = periods(d1=1000, d4=-3)
    period_oracle(engine, trading, periods(d4=306, d5=-60), periods(d3=100, d5=-60), stock)
    with Session(engine) as session:
        owner = applications(session, actor)
        CreditCorrectionService(owner).correct(
            identifier,
            CreditApplicationCorrection(
                businessDate="2026-02-08", amount="40", reason="Wrong offset period"
            ),
            match(owner, identifier),
            uuid4(),
        )
    period_oracle(
        engine,
        trading,
        periods(d4=306) | {date(2026, 2, 8): Decimal(-40)},
        periods(d3=100) | {date(2026, 2, 8): Decimal(-40)},
        stock,
    )
    with Session(engine) as session:
        owner = applications(session, actor)
        CreditCorrectionService(owner).cancel(
            identifier, Reason(reason="False offset"), match(owner, identifier), uuid4()
        )
    period_oracle(engine, trading, periods(d4=306), periods(d3=100), stock)
    after = snapshot(engine)
    assert after["inventory_entry"] == before["inventory_entry"]
    assert after["credit_lot"] == before["credit_lot"]
    assert [row for row in after["document"] if row["kind"] == "PAYMENT_RECEIPT"] == [
        row for row in before["document"] if row["kind"] == "PAYMENT_RECEIPT"
    ]
    assert_original_rows_preserved(before, after)
