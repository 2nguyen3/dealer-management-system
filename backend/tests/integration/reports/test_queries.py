from datetime import date
from decimal import ROUND_HALF_UP, Decimal, localcontext

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.core.request_context import set_audit_context
from app.modules.reports.queries import SALES
from app.modules.reports.service import ReportService
from tests.integration.catalogues.helpers import install_builders
from tests.integration.reports.test_oracles import (
    cash_rows,
    full_totals,
    inventory_oracle,
    ledger_oracle,
    product_sales_oracle,
    sales_oracle,
)

pytestmark = pytest.mark.integration


def test_sales_rate_rounds_once_with_exact_integer_arithmetic(engine):
    expression = (
        "CASE WHEN company.gross"
        + SALES.split("CASE WHEN company.gross", 1)[1].split(' AS "salesRate"', 1)[0]
    )
    statement = text(
        f'SELECT {expression} FROM (SELECT CAST(:amount AS numeric) AS "salesAmount") f '
        "CROSS JOIN (SELECT CAST(:gross AS numeric) AS gross) company"
    )
    with engine.connect() as connection, localcontext() as context:
        context.prec = 100
        for amount, gross in (
            (0, 0),
            (0, 10),
            (10, 10),
            (1, 3),
            (1000001000000000000, 2000000000000000001),
            (1000001000000000000, 2000000000000000000),
            (1000001000000000000, 1999999999999999999),
            (10**50 + 10**44, 2 * 10**50 + 1),
        ):
            expected = (
                (Decimal(amount) * 100 / Decimal(gross)).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP
                )
                if gross
                else Decimal(0)
            )
            actual = connection.scalar(
                statement, {"amount": Decimal(amount), "gross": Decimal(gross)}
            )
            assert actual == expected, (amount, gross, actual, expected)


def amounts(actual, expected, fields):
    for field in fields:
        assert Decimal(actual[field]) == expected[field], (field, actual[field], expected[field])


def assert_report_oracles(engine):
    with Session(engine) as session:
        service = ReportService(session, CursorCodec(b"r" * 32))
        for start, end in (
            (date(2026, 1, 1), date(2026, 2, 1)),
            (date(2026, 1, 4), date(2026, 1, 5)),
            (date(2026, 2, 1), date(2026, 3, 1)),
        ):
            sales = service.read("sales", start, end).model_dump(mode="json")
            oracle = sales_oracle(session, start, end)
            assert len(sales["items"]) == len(oracle["rows"])
            for actual, expected in zip(sales["items"], oracle["rows"], strict=True):
                assert int(actual["agencyId"]) == expected["agencyId"]
                assert actual["numberOfIssues"] == expected["issueCount"]
                amounts(actual, expected, ("salesAmount", "returnAmount", "netSalesAmount"))
                rate = (
                    (expected["salesAmount"] * 100 / oracle["companyGrossSales"]).quantize(
                        Decimal("0.0001"), rounding=ROUND_HALF_UP
                    )
                    if oracle["companyGrossSales"]
                    else Decimal(0)
                )
                assert Decimal(actual["salesRate"]) == rate
            assert Decimal(sales["totals"]["companyGrossSales"]) == oracle["companyGrossSales"]
            amounts(
                sales["totals"], oracle["totals"], ("salesAmount", "returnAmount", "netSalesAmount")
            )
            inventory = service.read("inventory", start, end).model_dump(mode="json")
            expected_inventory = inventory_oracle(session, start, end)
            assert len(inventory["items"]) == len(expected_inventory)
            for actual, expected in zip(inventory["items"], expected_inventory, strict=True):
                assert int(actual["productId"]) == expected["productId"]
                for field, source in (
                    ("openingStock", "openingStock"),
                    ("closingStock", "closingStock"),
                    ("receiptQuantity", "receivedQuantity"),
                    ("issueQuantity", "issuedQuantity"),
                    ("returnQuantity", "returnedQuantity"),
                    ("adjustmentQuantity", "adjustedQuantity"),
                ):
                    assert Decimal(actual[field]) == expected[source]
            products = service.read("product-sales", start, end, sort="productId").model_dump(
                mode="json"
            )
            expected_products = product_sales_oracle(session, start, end)
            assert len(products["items"]) == len(expected_products["rows"])
            for actual, expected in zip(products["items"], expected_products["rows"], strict=True):
                assert int(actual["productId"]) == expected["productId"]
                amounts(
                    actual,
                    expected,
                    (
                        "soldQuantity",
                        "returnedQuantity",
                        "salesAmount",
                        "returnAmount",
                        "netSalesAmount",
                    ),
                )
            amounts(
                products["totals"],
                expected_products["totals"],
                ("salesAmount", "returnAmount", "netSalesAmount"),
            )
            debt = service.read("debt", start, end).model_dump(mode="json")
            events = ledger_oracle(session, "receivable", start, end)
            expected_debt = {}
            for entry in events:
                row = expected_debt.setdefault(
                    entry["agencyId"],
                    {
                        "openingDebt": Decimal(0),
                        "debtIncrease": Decimal(0),
                        "cashApplied": Decimal(0),
                        "returnsApplied": Decimal(0),
                        "creditApplied": Decimal(0),
                        "closingDebt": Decimal(0),
                    },
                )
                row["openingDebt"] += entry["opening"]
                row["closingDebt"] += entry["closing"]
                field = {
                    "CHARGE": "debtIncrease",
                    "PAYMENT": "cashApplied",
                    "RETURN": "returnsApplied",
                    "CREDIT": "creditApplied",
                }[entry["kind"]]
                row[field] += entry["movement"] * (1 if entry["kind"] == "CHARGE" else -1)
            expected_debt = {
                key: row
                for key, row in expected_debt.items()
                if any(
                    row[field]
                    for field in ("debtIncrease", "cashApplied", "returnsApplied", "creditApplied")
                )
            }
            assert len(debt["items"]) == len(expected_debt)
            for actual in debt["items"]:
                expected = expected_debt[int(actual["agencyId"])]
                expected["debtDecrease"] = sum(
                    expected[field] for field in ("cashApplied", "returnsApplied", "creditApplied")
                )
                amounts(actual, expected, tuple(expected))
            amounts(
                debt["totals"],
                full_totals(list(expected_debt.values()), debt["totals"]),
                debt["totals"],
            )
            cash = service.read("cash-and-credit", start, end).model_dump(mode="json")
            expected_cash = cash_rows(session, start, end)
            assert {int(row["agencyId"]) for row in cash["items"]} == set(expected_cash)
            for actual in cash["items"]:
                amounts(actual, expected_cash[int(actual["agencyId"])], cash["totals"])
                assert Decimal(actual["closingCredit"]) == (
                    Decimal(actual["openingCredit"])
                    + Decimal(actual["creditCreated"])
                    - Decimal(actual["creditApplied"])
                    - Decimal(actual["creditRefunded"])
                )
            amounts(
                cash["totals"],
                full_totals(list(expected_cash.values()), cash["totals"]),
                cash["totals"],
            )
            # Filters and pages cannot change the company denominator or full totals.
            if sales["items"]:
                first = service.read("sales", start, end, limit=1).model_dump(mode="json")
                assert first["totals"] == sales["totals"]
                selected = service.read(
                    "sales", start, end, filters={"agencyId": sales["items"][0]["agencyId"]}
                ).model_dump(mode="json")
                assert (
                    selected["totals"]["companyGrossSales"] == sales["totals"]["companyGrossSales"]
                )
                if first["pagination"]["hasMore"]:
                    second = service.read(
                        "sales", start, end, limit=1, cursor=first["pagination"]["nextCursor"]
                    ).model_dump(mode="json")
                    assert second["totals"] == first["totals"]
                    assert second["items"][0]["agencyId"] != first["items"][0]["agencyId"]


def test_all_report_queries_reconcile_corrected_sources_ledgers_and_full_totals(
    engine, report_scenario
):
    assert_report_oracles(engine)
    with Session(engine) as session:
        result = (
            ReportService(session, CursorCodec(b"r" * 32))
            .read(
                "cash-and-credit",
                "2026-01-01",
                "2026-02-01",
                filters={"agencyId": str(report_scenario["agencies"][0])},
            )
            .model_dump(mode="json")
        )
        assert result["totals"] == {
            "cashReceived": "306",
            "cashRefunded": "40",
            "verifiedUnreceiptedAmount": "0",
            "openingCredit": "0",
            "creditCreated": "204",
            "creditApplied": "0",
            "creditRefunded": "40",
            "closingCredit": "164",
            "currentReservedCredit": "50",
            "currentAvailableCredit": "114",
        }


def test_inventory_report_accepts_valid_historical_balance_above_storage_bound(
    engine, actor, historical_inventory_scenario
):
    with engine.begin() as connection:
        set_audit_context(connection, actor, "m30-historical-inactive")
        connection.execute(
            text("UPDATE dms.product SET status='INACTIVE' WHERE id=:id"),
            {"id": historical_inventory_scenario["product"]},
        )
        connection.execute(
            text("UPDATE dms.unit SET status='INACTIVE' WHERE id=:id"),
            {"id": historical_inventory_scenario["unit"]},
        )
    with Session(engine) as session:
        service = ReportService(session, CursorCodec(b"r" * 32))
        for start, end, opening, closing in (
            (date(2026, 1, 1), date(2026, 1, 2), "0", "1200000000000000"),
            (date(2026, 1, 2), date(2026, 1, 3), "1200000000000000", "700000000000000"),
        ):
            result = service.read(
                "inventory",
                start,
                end,
                filters={"productId": str(historical_inventory_scenario["product"])},
            ).model_dump(mode="json")
            assert result["items"][0]["openingStock"] == opening
            assert result["items"][0]["closingStock"] == closing


def test_verified_evidence_uses_received_at_vietnam_half_open_boundaries(engine, actor, trading):
    with Session(engine) as session:
        install_builders(session, actor)
        for received in (
            "2026-01-31T16:59:59+00:00",
            "2026-01-31T17:00:00+00:00",
            "2026-02-28T17:00:00+00:00",
        ):
            identifier = session.scalar(
                text("""
                SELECT pg_temp.stock_draft('STOCK_ISSUE',:agency,DATE '2026-01-02',
                  jsonb_build_array(jsonb_build_object('product',CAST(:product AS bigint),
                    'quantity',3)),gen_random_uuid())
            """),
                {"agency": trading[0], "product": trading[1]},
            )
            session.execute(text("SELECT pg_temp.ready(:id,40)"), {"id": identifier})
            session.execute(
                text("""
                INSERT INTO dms.upfront_confirmation ("issueRevisionId",amount,method,
                  "receivedAt","verifiedBy","evidenceReference")
                SELECT "currentRevisionId",40,'CASH',CAST(:received AS timestamptz),:actor,:received
                FROM dms.document WHERE id=:id
            """),
                {"id": identifier, "received": received, "actor": actor},
            )
        session.commit()
    with Session(engine) as session:
        service = ReportService(session, CursorCodec(b"r" * 32))
        for start, end in (
            ("2026-01-31", "2026-02-01"),
            ("2026-02-01", "2026-03-01"),
            ("2026-03-01", "2026-03-02"),
        ):
            result = service.read("cash-and-credit", start, end)
            assert result.totals.verifiedUnreceiptedAmount == 40
            assert result.totals.cashReceived == result.totals.closingCredit == 0
            assert len(result.items) == 1
