from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import text

from tests.integration.dashboard.test_dashboard import read
from tests.integration.document_corrections import test_financial_periods as workflows
from tests.integration.reports import test_replay as replays
from tests.integration.reports.test_oracles import cash_oracle, sales_oracle

pytestmark = pytest.mark.integration


@pytest.mark.parametrize(
    "workflow",
    [
        replays.test_goods_adjustment_and_manual_receipt_moves_cancels_reconcile_every_report,
        workflows.test_issue_and_auto_receipt_move_then_cancel_restate_original_periods,
        workflows.test_paid_return_move_then_cancel_restate_stock_and_credit_periods,
        workflows.test_credit_move_then_cancel_restate_offset_period_without_new_cash,
    ],
)
def test_dashboard_reconciles_after_every_original_period_move_and_cancel(
    engine, actor, trading, dashboard, monkeypatch, workflow
):
    checkpoints = []

    def verify(*_args, **_kwargs):
        for month, start, end in (
            ("2026-01", date(2026, 1, 1), date(2026, 2, 1)),
            ("2026-02", date(2026, 2, 1), date(2026, 3, 1)),
        ):
            actual = read(dashboard, month)
            with engine.connect() as connection:
                sales = sales_oracle(connection, start, end)["totals"]
                for key, expected in (
                    ("gross", "salesAmount"),
                    ("returns", "returnAmount"),
                    ("net", "netSalesAmount"),
                ):
                    assert Decimal(actual["sales"][key]) == sales[expected]
                    assert actual["sales"]["monthlyTrend"][-1][key] == actual["sales"][key]
                cash = cash_oracle(connection, start, end)
                for key, kind in (("cashReceived", "PAYMENT_RECEIPT"), ("cashRefunded", "REFUND")):
                    assert Decimal(actual["receivables"][key]) == sum(
                        (row["amount"] for row in cash["cash"] if row["kind"] == kind), Decimal(0)
                    )
                receipts = connection.execute(
                    text("""SELECT d.status,r.state,r."businessDate",r."totalAmount"
                        FROM dms.document d JOIN dms.document_revision r
                        ON r.id=d."currentRevisionId" WHERE d.kind='STOCK_RECEIPT' """)
                ).mappings()
                expected_receipts = sum(
                    (
                        row["totalAmount"]
                        for row in receipts
                        if row["status"] == row["state"] == "POSTED"
                        and start <= row["businessDate"] < end
                    ),
                    Decimal(0),
                )
                assert Decimal(actual["inventory"]["receivedAmount"]) == expected_receipts
        checkpoints.append(True)

    if (
        workflow
        is replays.test_goods_adjustment_and_manual_receipt_moves_cancels_reconcile_every_report
    ):
        monkeypatch.setattr(replays, "assert_report_oracles", verify)
    else:
        original = workflows.period_oracle

        def checked(*args, **kwargs):
            original(*args, **kwargs)
            verify()

        monkeypatch.setattr(workflows, "period_oracle", checked)
    workflow(engine, actor, trading)
    assert len(checkpoints) >= 3
