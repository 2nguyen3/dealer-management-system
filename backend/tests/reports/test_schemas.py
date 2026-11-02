import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from pydantic import ValidationError

from app.modules.reports.schemas import (
    DebtFilters,
    InventoryReportRow,
    ReportInterval,
    ReportPeriod,
    SalesFilters,
    SalesReportRow,
)
from app.modules.reports.service import REPORTS

NOW = datetime(2026, 1, 10, tzinfo=UTC)


def example_row(kind, identifier="1", **overrides):
    row_model = REPORTS[kind][1]
    row = {field: Decimal(0) for field in row_model.model_fields}
    if kind in ("inventory", "product-sales"):
        row.update(
            productId=identifier,
            productCode="P",
            productName="Same name",
            unitId=1,
            unitName="Unit",
        )
    else:
        row.update(agencyId=identifier, agencyCode="A", agencyName="Same name")
    if kind == "sales":
        row["numberOfIssues"] = 0
    row.update(overrides)
    return row


@pytest.mark.parametrize("kind", REPORTS)
def test_canonical_models(kind):
    row_model, response_model, total_model = REPORTS[kind][1:]
    row = row_model.model_validate(example_row(kind))
    values = dict(
        fromDate="2026-01-01",
        toDate="2026-02-01",
        generatedAt=NOW,
        items=[row],
        pagination={"limit": 25, "hasMore": False, "nextCursor": None},
    )
    if total_model is not None:
        totals = {key: Decimal(0) for key in total_model.model_fields}
        if kind == "sales":
            totals["numberOfIssues"] = 0
        values["totals"] = totals
    payload = response_model.model_validate(values).model_dump(mode="json")
    document = json.loads(
        (Path(__file__).parents[3] / "openwiki/backend-design/API/openapi.json").read_text("utf-8")
    )
    schema = {**document, "$ref": f"#/components/schemas/{response_model.__name__}"}
    Draft202012Validator(schema).validate(payload)
    identifier = "productId" if kind in ("inventory", "product-sales") else "agencyId"
    assert payload["items"][0][identifier] == "1"
    with pytest.raises(ValidationError):
        row_model.model_validate({**example_row(kind), "unknown": "not allowed"})


@pytest.mark.parametrize("value", [1, 1.0, float("nan"), float("inf"), "1e2", "NaN", "Infinity"])
def test_exact_numbers_reject_lossy_inputs(value):
    with pytest.raises(ValidationError):
        SalesReportRow.model_validate(example_row("sales", salesAmount=value))


def test_unbounded_exact_aggregates_and_historical_inventory():
    huge = "12345678901234567890123456789012345678901234567890"
    row = SalesReportRow.model_validate(
        example_row("sales", salesAmount=huge, netSalesAmount="-" + huge, salesRate="33.3333")
    )
    assert row.model_dump(mode="json")["salesAmount"] == huge
    assert row.model_dump(mode="json")["netSalesAmount"] == "-" + huge
    stock = InventoryReportRow.model_validate(
        example_row("inventory", openingStock="1200000000000000", closingStock="1200000000000000")
    )
    assert stock.model_dump(mode="json")["openingStock"] == "1200000000000000"
    normalized = InventoryReportRow.model_validate(
        example_row("inventory", adjustmentQuantity=Decimal("-0.000"), receiptQuantity="0.001")
    )
    assert normalized.model_dump(mode="json")["adjustmentQuantity"] == "0"
    assert normalized.model_dump(mode="json")["receiptQuantity"] == "0.001"
    for name, value in (("openingStock", "-1"), ("issueQuantity", "1.0001")):
        with pytest.raises(ValidationError):
            InventoryReportRow.model_validate(example_row("inventory", **{name: value}))


@pytest.mark.parametrize("count", [True, "1", 1.0, -1])
def test_count_is_nonnegative_integer(count):
    with pytest.raises(ValidationError):
        SalesReportRow.model_validate(example_row("sales", numberOfIssues=count))


@pytest.mark.parametrize("rate", ["100.0001", "-0.1", "33.33333"])
def test_percentage_boundaries(rate):
    with pytest.raises(ValidationError):
        SalesReportRow.model_validate(example_row("sales", salesRate=rate))


@pytest.mark.parametrize("identifier", ["0", "01", "-1", "9223372036854775808", 1])
def test_filter_ids(identifier):
    with pytest.raises(ValidationError):
        SalesFilters(agencyId=identifier)


def test_catalog_filters_and_strict_period():
    filters = DebtFilters(agencyId="9223372036854775807", typeId="2147483647", districtId=1)
    assert filters.typeId == 2147483647
    for bad in (True, "01", 0, 2147483648):
        with pytest.raises(ValidationError):
            DebtFilters(typeId=bad)
    assert ReportInterval(fromDate="2024-02-29", toDate="2024-03-02").fromDate.day == 29
    for start, end in (
        ("2026-02-29", "2026-03-01"),
        ("2026-01-01", "2026-01-01"),
        ("2026-01-02", "2026-01-01"),
        ("2026-1-01", "2026-02-01"),
    ):
        with pytest.raises(ValidationError):
            ReportInterval(fromDate=start, toDate=end)


def test_period_requires_aware_generated_at_and_identity_types():
    with pytest.raises(ValidationError):
        ReportPeriod(fromDate="2026-01-01", toDate="2026-02-01", generatedAt=datetime(2026, 1, 1))
    with pytest.raises(ValidationError):
        SalesReportRow.model_validate(example_row("sales", agencyName=None))
    with pytest.raises(ValidationError):
        InventoryReportRow.model_validate(example_row("inventory", unitId="1"))
