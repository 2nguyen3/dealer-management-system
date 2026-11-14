"""Reports on real PostgreSQL: Σ over POSTED documents only (handoff 3.4).

Every scenario mixes posted, cancelled and draft documents and a document dated on the
last day of the previous month, so exclusion and month boundaries are always exercised.
"""

from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.core.exceptions import ApiError
from app.modules.reports.service import ReportService
from tests.integration.reports.conftest import issue, payment, receipt

pytestmark = pytest.mark.integration


@pytest.fixture
def reports(engine):
    with Session(engine) as session:
        yield ReportService(session, CursorCodec(b"r" * 32))


def by_id(response, field):
    return {getattr(row, field): row for row in response.items}


# ------------------------------------------------------------------ sales ----


def test_sales_counts_posted_issues_only_with_exact_shares(reports, ledger, world, dates, stocked):
    first = ledger.post("STOCK_ISSUE", issue(world.agency, (world.noodles, 1)))
    second = ledger.post("STOCK_ISSUE", issue(world.agency, (world.noodles, 2)))
    other = ledger.post("STOCK_ISSUE", issue(world.second_agency, (world.noodles, 1)))
    cancelled = ledger.post("STOCK_ISSUE", issue(world.second_agency, (world.noodles, 5)))
    ledger.cancel("STOCK_ISSUE", cancelled)
    ledger.draft("STOCK_ISSUE", issue(world.second_agency, (world.noodles, 7)))
    ledger.post(
        "STOCK_ISSUE",
        issue(world.second_agency, (world.noodles, 9), business_date=dates["previousLast"]),
    )

    result = reports.read("sales", dates["start"], dates["end"])
    rows = by_id(result, "agencyId")
    assert set(rows) == {str(world.agency), str(world.second_agency)}
    mine, theirs = rows[str(world.agency)], rows[str(world.second_agency)]
    assert mine.numberOfIssues == 2
    assert mine.salesAmount == first.totalAmount + second.totalAmount == Decimal(306000)
    assert theirs.numberOfIssues == 1 and theirs.salesAmount == other.totalAmount
    assert (mine.salesRate, theirs.salesRate) == (Decimal(75), Decimal(25))
    assert sum(row.salesRate for row in result.items) == 100
    assert result.totals.numberOfIssues == 3
    assert result.totals.salesAmount == result.totals.companySalesAmount == Decimal(408000)
    assert mine.agencyCode == f"DL-{world.agency}" and mine.agencyName == "Tạp hóa Hồng Phúc"


def test_sales_rate_rounds_once_and_filter_keeps_company_denominator(
    reports, ledger, world, dates, stocked
):
    ledger.post("STOCK_ISSUE", issue(world.agency, (world.noodles, 2)))
    ledger.post("STOCK_ISSUE", issue(world.second_agency, (world.noodles, 1)))
    result = reports.read("sales", dates["start"], dates["end"])
    rates = {row.agencyId: row.salesRate for row in result.items}
    assert rates == {
        str(world.agency): Decimal("66.6667"),
        str(world.second_agency): Decimal("33.3333"),
    }
    assert sum(rates.values()) == 100

    filtered = reports.read(
        "sales", dates["start"], dates["end"], filters={"agencyId": str(world.second_agency)}
    )
    assert [row.agencyId for row in filtered.items] == [str(world.second_agency)]
    assert filtered.items[0].salesRate == Decimal("33.3333")
    assert filtered.totals.salesAmount == Decimal(102000)
    assert filtered.totals.companySalesAmount == Decimal(306000)


def test_sales_empty_period_and_previous_month_boundary(reports, ledger, world, dates, stocked):
    ledger.post(
        "STOCK_ISSUE",
        issue(world.agency, (world.noodles, 1), business_date=dates["previousLast"]),
    )
    current = reports.read("sales", dates["start"], dates["end"])
    assert current.items == [] and current.totals.companySalesAmount == 0
    previous = reports.read("sales", dates["previousStart"], dates["start"])
    assert [(row.agencyId, row.numberOfIssues) for row in previous.items] == [
        (str(world.agency), 1)
    ]
    assert previous.items[0].salesRate == 100


# ------------------------------------------------------------------- debt ----


def debt_scenario(ledger, world, dates):
    previous = dates["previousLast"]
    ledger.post("STOCK_ISSUE", issue(world.agency, (world.noodles, 10), business_date=previous))
    ledger.post("PAYMENT_RECEIPT", payment(world.agency, 200000, business_date=previous))
    # Second agency: opening debt only, no movement this month.
    ledger.post(
        "STOCK_ISSUE", issue(world.second_agency, (world.noodles, 1), business_date=previous)
    )
    ledger.post("STOCK_ISSUE", issue(world.agency, (world.noodles, 3)))
    ledger.post("PAYMENT_RECEIPT", payment(world.agency, 100000))
    ledger.post("PAYMENT_RECEIPT", payment(world.agency, 50000, "BANK_TRANSFER"))
    cancelled = ledger.post("PAYMENT_RECEIPT", payment(world.agency, 70000))
    ledger.cancel("PAYMENT_RECEIPT", cancelled)
    cancelled_issue = ledger.post("STOCK_ISSUE", issue(world.agency, (world.noodles, 4)))
    ledger.cancel("STOCK_ISSUE", cancelled_issue)
    ledger.draft("PAYMENT_RECEIPT", payment(world.agency, 10000))
    ledger.draft("STOCK_ISSUE", issue(world.agency, (world.noodles, 2)))


def test_debt_report_formula_and_current_closing_equals_agency_debt(
    reports, ledger, world, dates, stocked
):
    debt_scenario(ledger, world, dates)
    result = reports.read("debt", dates["start"], dates["end"])
    rows = by_id(result, "agencyId")
    # The terminated agency has no history and is not listed.
    assert set(rows) == {str(world.agency), str(world.second_agency)}
    mine = rows[str(world.agency)]
    assert mine.openingDebt == Decimal(1020000 - 200000)
    assert mine.debtIncrease == Decimal(306000)
    assert mine.paidAmount == Decimal(150000)
    assert mine.closingDebt == mine.openingDebt + mine.debtIncrease - mine.paidAmount
    theirs = rows[str(world.second_agency)]
    assert (theirs.openingDebt, theirs.debtIncrease, theirs.paidAmount) == (102000, 0, 0)
    assert theirs.closingDebt == 102000

    _, debt = ledger.current()
    for agency, row in rows.items():
        assert row.closingDebt == debt[agency]
    assert result.totals.closingDebt == sum(row.closingDebt for row in result.items)
    assert result.totals.openingDebt == Decimal(922000)


def test_debt_previous_month_counts_last_day_as_increase(reports, ledger, world, dates, stocked):
    debt_scenario(ledger, world, dates)
    previous = reports.read("debt", dates["previousStart"], dates["start"])
    mine = by_id(previous, "agencyId")[str(world.agency)]
    assert (mine.openingDebt, mine.debtIncrease, mine.paidAmount) == (0, 1020000, 200000)
    current = reports.read("debt", dates["start"], dates["end"])
    # Closing of the previous month is the opening of the current one.
    assert by_id(current, "agencyId")[str(world.agency)].openingDebt == mine.closingDebt


def test_debt_report_negative_debt_from_late_online_payment(reports, ledger, world, dates, stocked):
    ledger.post("STOCK_ISSUE", issue(world.agency, (world.noodles, 1)))
    ledger.online(world.agency, 150000)
    result = reports.read("debt", dates["start"], dates["end"])
    mine = by_id(result, "agencyId")[str(world.agency)]
    assert mine.paidAmount == 150000 and mine.closingDebt == Decimal(-48000)
    assert mine.closingDebt == ledger.current()[1][str(world.agency)]


def test_debt_filters_by_type_and_ward(reports, ledger, world, dates, stocked):
    debt_scenario(ledger, world, dates)
    ward = reports.read("debt", dates["start"], dates["end"], filters={"wardId": 2})
    assert [row.agencyId for row in ward.items] == [str(world.second_agency)]
    other_type = reports.read("debt", dates["start"], dates["end"], filters={"typeId": 2})
    assert other_type.items == [] and other_type.totals.closingDebt == 0


# -------------------------------------------------------------- inventory ----


def test_inventory_period_and_current_closing_equals_product_stock(
    reports, ledger, world, dates, stocked
):
    ledger.post("STOCK_RECEIPT", receipt((world.rice, Decimal("2.5"), 21000)))
    ledger.post("STOCK_ISSUE", issue(world.agency, (world.noodles, 3), (world.rice, 1)))
    cancelled = ledger.post("STOCK_RECEIPT", receipt((world.noodles, 5, 90000)))
    ledger.cancel("STOCK_RECEIPT", cancelled)
    ledger.draft("STOCK_RECEIPT", receipt((world.noodles, 40, 90000)))
    ledger.draft("STOCK_ISSUE", issue(world.agency, (world.noodles, 6)))

    result = reports.read("inventory", dates["start"], dates["end"])
    rows = by_id(result, "productId")
    noodles, rice = rows[str(world.noodles)], rows[str(world.rice)]
    assert (noodles.openingStock, noodles.receiptQuantity, noodles.issueQuantity) == (100, 0, 3)
    assert noodles.closingStock == 97
    assert (rice.openingStock, rice.receiptQuantity, rice.issueQuantity) == (
        50,
        Decimal("2.5"),
        1,
    )
    assert rice.closingStock == Decimal("51.5")
    assert noodles.unitName == "Thùng" and rice.unitName == "Kg"
    unpriced = rows[str(world.unpriced)]
    assert (unpriced.openingStock, unpriced.closingStock) == (0, 0)
    stock, _ = ledger.current()
    assert {product: row.closingStock for product, row in rows.items()} == stock

    previous = reports.read(
        "inventory",
        dates["previousStart"],
        dates["start"],
        filters={"productId": str(world.noodles)},
    )
    assert len(previous.items) == 1
    row = previous.items[0]
    assert (row.openingStock, row.receiptQuantity, row.issueQuantity, row.closingStock) == (
        0,
        100,
        0,
        100,
    )


# ---------------------------------------------------------- product sales ----


def test_product_sales_quantity_value_and_agency_filter(reports, ledger, world, dates, stocked):
    ledger.post("STOCK_ISSUE", issue(world.agency, (world.noodles, 2), (world.rice, "1.5")))
    ledger.post("STOCK_ISSUE", issue(world.second_agency, (world.noodles, 1)))
    cancelled = ledger.post("STOCK_ISSUE", issue(world.agency, (world.rice, 3)))
    ledger.cancel("STOCK_ISSUE", cancelled)
    ledger.draft("STOCK_ISSUE", issue(world.agency, (world.noodles, 4)))

    result = reports.read("product-sales", dates["start"], dates["end"])
    rows = by_id(result, "productId")
    assert set(rows) == {str(world.noodles), str(world.rice)}
    noodles, rice = rows[str(world.noodles)], rows[str(world.rice)]
    assert (noodles.numberOfIssues, noodles.soldQuantity, noodles.salesAmount) == (
        2,
        3,
        306000,
    )
    assert (rice.numberOfIssues, rice.soldQuantity, rice.salesAmount) == (
        1,
        Decimal("1.5"),
        30600,
    )
    assert [row.productId for row in result.items] == [str(world.noodles), str(world.rice)]
    assert result.totals.salesAmount == 336600

    filtered = reports.read(
        "product-sales",
        dates["start"],
        dates["end"],
        filters={"agencyId": str(world.second_agency)},
    )
    assert [(row.productId, row.soldQuantity) for row in filtered.items] == [
        (str(world.noodles), 1)
    ]


# ------------------------------------------------------------ collections ----


def test_collections_split_by_receipt_type_and_date(reports, ledger, world, dates, stocked):
    previous = dates["previousLast"]
    ledger.post("STOCK_ISSUE", issue(world.agency, (world.noodles, 10), business_date=previous))
    ledger.post("PAYMENT_RECEIPT", payment(world.agency, 300000, business_date=previous))
    ledger.post("PAYMENT_RECEIPT", payment(world.agency, 100000, business_date=dates["start"]))
    ledger.post("PAYMENT_RECEIPT", payment(world.agency, 120000))
    ledger.post("PAYMENT_RECEIPT", payment(world.agency, 80000, "BANK_TRANSFER"))
    ledger.online(world.agency, 50000)
    cancelled = ledger.post("PAYMENT_RECEIPT", payment(world.agency, 1000))
    ledger.cancel("PAYMENT_RECEIPT", cancelled)
    ledger.draft("PAYMENT_RECEIPT", payment(world.agency, 2000))

    result = reports.read("collections", dates["start"], dates["end"])
    assert result.totals.model_dump(mode="json") == {
        "receiptCount": 4,
        "cashAmount": "220000",
        "bankTransferAmount": "80000",
        "onlineAmount": "50000",
        "totalAmount": "350000",
    }
    rows = {row.businessDate: row for row in result.items}
    assert [row.businessDate for row in result.items] == sorted(rows)
    for row in result.items:
        assert row.totalAmount == row.cashAmount + row.bankTransferAmount + row.onlineAmount
    latest = rows[dates["today"]]
    assert latest.bankTransferAmount == 80000 and latest.onlineAmount == 50000
    if dates["today"] != dates["start"]:
        assert set(rows) == {dates["start"], dates["today"]}
        assert rows[dates["start"]].cashAmount == 100000
        assert latest.receiptCount == 3

    cash = reports.read(
        "collections", dates["start"], dates["end"], filters={"receiptType": "CASH"}
    )
    assert cash.totals.totalAmount == cash.totals.cashAmount == 220000
    assert cash.totals.onlineAmount == 0
    previous_month = reports.read("collections", dates["previousStart"], dates["start"])
    assert [(row.businessDate, row.cashAmount) for row in previous_month.items] == [
        (previous, 300000)
    ]


# ---------------------------------------------------- paging and failures ----


def test_paging_cursor_walks_rows_and_rejects_foreign_scope(reports, ledger, world, dates, stocked):
    ledger.post("STOCK_ISSUE", issue(world.agency, (world.noodles, 1)))
    ledger.post("STOCK_ISSUE", issue(world.second_agency, (world.noodles, 2)))
    first = reports.read("sales", dates["start"], dates["end"], limit=1, sort="-salesAmount")
    assert [row.agencyId for row in first.items] == [str(world.second_agency)]
    assert first.pagination.hasMore and first.totals.numberOfIssues == 2
    second = reports.read(
        "sales",
        dates["start"],
        dates["end"],
        limit=1,
        sort="-salesAmount",
        cursor=first.pagination.nextCursor,
    )
    assert [row.agencyId for row in second.items] == [str(world.agency)]
    assert not second.pagination.hasMore and second.pagination.nextCursor is None
    with pytest.raises(ApiError) as error:
        reports.read(
            "sales",
            dates["start"],
            dates["end"],
            sort="agencyId",
            cursor=first.pagination.nextCursor,
        )
    assert error.value.code == "INVALID_CURSOR"


def test_reports_do_not_write_and_export_matches_rows(reports, ledger, world, dates, stocked):
    ledger.post("STOCK_ISSUE", issue(world.agency, (world.noodles, 1)))
    before = ledger.current()
    dataset = reports.read("debt", dates["start"], dates["end"], export=True)
    assert ledger.current() == before
    assert [row["agencyId"] for row in dataset["rows"]] == [str(world.agency)]
    assert dataset["rows"][0]["closingDebt"] == "102000"
    assert dataset["totals"]["closingDebt"] == "102000"
