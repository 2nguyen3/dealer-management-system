from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.modules.reports import schemas

START, END = date(2026, 10, 1), date(2026, 11, 1)


def example_row(kind, identity="1"):
    """One valid row of each report, with exact string figures as the API emits."""
    agency = {"agencyId": identity, "agencyCode": f"DL-{identity}", "agencyName": "Tạp hóa An"}
    product = {
        "productId": identity,
        "productCode": f"MH-{identity}",
        "productName": "Gạo ST25",
        "unitId": 2,
        "unitName": "Kg",
    }
    return {
        "sales": agency | {"numberOfIssues": 3, "salesAmount": "306000", "salesRate": "75"},
        "debt": agency
        | {
            "openingDebt": "-48000",
            "debtIncrease": "306000",
            "paidAmount": "150000",
            "closingDebt": "108000",
        },
        "inventory": product
        | {
            "openingStock": "100",
            "receiptQuantity": "2.5",
            "issueQuantity": "3",
            "closingStock": "99.5",
        },
        "product-sales": product
        | {"numberOfIssues": 2, "soldQuantity": "1.5", "salesAmount": "30600"},
        "collections": {
            "businessDate": f"2026-10-{int(identity):02d}",
            "receiptCount": 2,
            "cashAmount": "100000",
            "bankTransferAmount": "50000",
            "onlineAmount": "0",
            "totalAmount": "150000",
        },
    }[kind]


ROWS = {
    "sales": schemas.SalesReportRow,
    "debt": schemas.DebtReportRow,
    "inventory": schemas.InventoryReportRow,
    "product-sales": schemas.ProductSalesReportRow,
    "collections": schemas.CollectionsReportRow,
}


def test_interval_requires_start_before_end():
    assert schemas.ReportInterval(fromDate="2026-10-01", toDate="2026-10-02").toDate == date(
        2026, 10, 2
    )
    for start, end in (("2026-10-01", "2026-10-01"), ("2026-10-02", "2026-10-01")):
        with pytest.raises(ValidationError):
            schemas.ReportInterval(fromDate=start, toDate=end)
    with pytest.raises(ValidationError):
        schemas.ReportInterval(fromDate="2026-10-1", toDate="2026-11-01")


@pytest.mark.parametrize("kind", ROWS)
def test_rows_round_trip_exact_strings(kind):
    row = ROWS[kind].model_validate(example_row(kind))
    assert row.model_dump(mode="json") == example_row(kind)


def test_row_column_order_starts_with_identity():
    assert list(schemas.DebtReportRow.model_fields) == [
        "agencyId",
        "agencyCode",
        "agencyName",
        "openingDebt",
        "debtIncrease",
        "paidAmount",
        "closingDebt",
    ]
    assert list(schemas.CollectionsReportRow.model_fields)[0] == "businessDate"
    assert list(schemas.InventoryReportRow.model_fields)[-1] == "closingStock"


@pytest.mark.parametrize(
    ("kind", "field", "value"),
    [
        ("sales", "salesRate", "100.0001"),
        ("sales", "salesRate", "-1"),
        ("sales", "salesAmount", "-1"),
        ("sales", "numberOfIssues", -1),
        ("sales", "numberOfIssues", "3"),
        ("debt", "debtIncrease", "-1"),
        ("debt", "paidAmount", "1.5"),
        ("debt", "agencyId", "0"),
        ("inventory", "receiptQuantity", "1.0001"),
        ("inventory", "issueQuantity", "-1"),
        ("product-sales", "soldQuantity", 1.5),
        ("collections", "businessDate", "2026-10-1"),
        ("collections", "onlineAmount", "-5"),
    ],
)
def test_rows_reject_invalid_figures(kind, field, value):
    with pytest.raises(ValidationError):
        ROWS[kind].model_validate(example_row(kind) | {field: value})


def test_signed_balances_and_boundary_percentages_are_accepted():
    debt = schemas.DebtReportRow.model_validate(
        example_row("debt") | {"openingDebt": "-1", "closingDebt": "-999999999999999999999"}
    )
    assert debt.closingDebt == Decimal("-999999999999999999999")
    stock = schemas.InventoryReportRow.model_validate(
        example_row("inventory") | {"openingStock": "-0.5"}
    )
    assert stock.openingStock == Decimal("-0.5")
    for rate in ("0", "100", "33.3333"):
        schemas.SalesReportRow.model_validate(example_row("sales") | {"salesRate": rate})


def test_filters_accept_known_values_only():
    assert schemas.CollectionsFilters(receiptType="ONLINE").receiptType == "ONLINE"
    assert schemas.DebtFilters(typeId="2", wardId=3).model_dump() == {
        "agencyId": None,
        "typeId": 2,
        "wardId": 3,
    }
    for bad in ({"receiptType": "REFUND"}, {"agencyId": "x"}, {"unknown": "1"}):
        with pytest.raises(ValidationError):
            schemas.CollectionsFilters.model_validate(bad)
    with pytest.raises(ValidationError):
        schemas.DebtFilters(typeId="0")
