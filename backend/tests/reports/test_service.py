from datetime import UTC, date, datetime
from decimal import Decimal
from unittest.mock import Mock

import pytest

from app.common.pagination import CursorCodec
from app.core.exceptions import ApiError
from app.modules.reports.service import REPORTS, ReportService
from tests.reports.test_schemas import END, START, example_row

GENERATED = datetime(2026, 11, 14, 3, 0, tzinfo=UTC)


def service_with_rows(kind, rows, company=None):
    service = ReportService(Mock(), CursorCodec(b"s" * 32))
    detached = {"generatedAt": GENERATED, "rows": rows}
    if kind == "sales":
        detached["companySalesAmount"] = Decimal(
            company if company is not None else sum(int(row["salesAmount"]) for row in rows)
        )
    service.queries = Mock()
    service.queries.read.return_value = detached
    return service


def sales_rows(*amounts):
    return [
        example_row("sales", str(index)) | {"salesAmount": str(amount), "numberOfIssues": index}
        for index, amount in enumerate(amounts, 1)
    ]


def test_default_sort_totals_and_query_arguments():
    service = service_with_rows("sales", sales_rows(300, 100, 200))
    result = service.read("sales", START, END, filters={"agencyId": "2", "typeId": "1"})
    assert [row.agencyId for row in result.items] == ["1", "2", "3"]
    assert result.totals.model_dump(mode="json") == {
        "numberOfIssues": 6,
        "salesAmount": "600",
        "companySalesAmount": "600",
    }
    assert result.generatedAt == GENERATED and result.fromDate == START
    service.queries.read.assert_called_once_with(
        "sales", START, END, {"agencyId": "2", "typeId": 1}
    )


def test_totals_are_exact_beyond_decimal_context():
    huge = "9" * 40
    service = service_with_rows("debt", [example_row("debt", "1") | {"closingDebt": huge}] * 2)
    result = service.read("debt", START, END)
    assert result.totals.closingDebt == Decimal(int(huge) * 2)
    assert result.totals.openingDebt == Decimal(-96000)


def test_descending_amount_pages_with_cursor():
    service = service_with_rows("sales", sales_rows(100, 300, 300, 200))
    first = service.read("sales", START, END, limit=2, sort="-salesAmount")
    assert [row.agencyId for row in first.items] == ["3", "2"]
    assert first.pagination.hasMore
    second = service.read(
        "sales", START, END, limit=2, sort="-salesAmount", cursor=first.pagination.nextCursor
    )
    assert [row.agencyId for row in second.items] == ["4", "1"]
    assert second.pagination.model_dump() == {"limit": 2, "hasMore": False, "nextCursor": None}


def test_count_and_date_cursors_round_trip():
    service = service_with_rows("sales", sales_rows(1, 2, 3))
    page = service.read("sales", START, END, limit=1, sort="numberOfIssues")
    following = service.read(
        "sales", START, END, limit=1, sort="numberOfIssues", cursor=page.pagination.nextCursor
    )
    assert following.items[0].numberOfIssues == 2

    rows = [example_row("collections", str(day)) for day in (3, 1, 2)]
    service = service_with_rows("collections", rows)
    page = service.read("collections", START, END, limit=2)
    assert [row.businessDate for row in page.items] == [date(2026, 10, 1), date(2026, 10, 2)]
    last = service.read("collections", START, END, limit=2, cursor=page.pagination.nextCursor)
    assert [row.businessDate for row in last.items] == [date(2026, 10, 3)]
    assert last.totals.receiptCount == 6 and last.totals.totalAmount == 450000


@pytest.mark.parametrize(
    "controls",
    [
        {"sort": "netSalesAmount"},
        {"sort": "--salesAmount"},
        {"sort": 1},
        {"limit": 0},
        {"limit": 101},
        {"limit": "25"},
    ],
)
def test_invalid_page_controls(controls):
    service = service_with_rows("sales", sales_rows(1))
    with pytest.raises(ApiError) as error:
        service.read("sales", START, END, **controls)
    assert (error.value.status, error.value.code) == (422, "VALIDATION_FAILED")
    service.queries.read.assert_not_called()


@pytest.mark.parametrize(
    ("kind", "start", "end", "filters"),
    [
        ("cash-and-credit", START, END, None),
        ("sales", END, START, None),
        ("sales", START, START, None),
        ("collections", START, END, {"receiptType": "REFUND"}),
        ("debt", START, END, {"wardId": "0"}),
    ],
)
def test_invalid_kind_period_or_filters(kind, start, end, filters):
    service = service_with_rows("sales", [])
    with pytest.raises(ApiError) as error:
        service.read(kind, start, end, filters=filters)
    assert error.value.status == 422


def test_foreign_tampered_or_stale_cursor_is_rejected():
    service = service_with_rows("sales", sales_rows(1, 2, 3))
    cursor = service.read("sales", START, END, limit=1).pagination.nextCursor
    for kwargs in (
        {"sort": "salesAmount", "cursor": cursor},
        {"cursor": cursor[:-2] + "AA"},
        {"cursor": cursor, "filters": {"agencyId": "1"}},
    ):
        with pytest.raises(ApiError) as error:
            service.read("sales", START, END, limit=1, **kwargs)
        assert error.value.code == "INVALID_CURSOR"
    # The anchor row disappeared between pages.
    service.queries.read.return_value = {
        "generatedAt": GENERATED,
        "rows": sales_rows(1, 2, 3)[1:],
        "companySalesAmount": Decimal(5),
    }
    with pytest.raises(ApiError) as error:
        service.read("sales", START, END, limit=1, cursor=cursor)
    assert error.value.code == "INVALID_CURSOR"


def test_empty_reports_have_zero_totals():
    for kind in REPORTS:
        result = service_with_rows(kind, []).read(kind, START, END)
        assert result.items == [] and not result.pagination.hasMore
        if REPORTS[kind].totals is not None:
            assert all(
                value in ("0", 0) for value in result.totals.model_dump(mode="json").values()
            )


@pytest.mark.parametrize("kind", REPORTS)
def test_export_dataset_is_complete_and_sorted_by_identity(kind):
    rows = [example_row(kind, str(index)) for index in (12, 3, 7)]
    dataset = service_with_rows(kind, rows).read(kind, START, END, export=True, limit=1, sort="bad")
    identity = dataset["columns"][0][0]
    assert dataset["kind"] == kind and dataset["title"] == REPORTS[kind].title
    assert len(dataset["rows"]) == 3
    keys = [row[identity] for row in dataset["rows"]]
    assert keys == sorted(keys, key=lambda value: value if "-" in value else int(value))
    assert dataset["period"]["fromDate"] == "2026-10-01"
    assert [key for key, _ in dataset["columns"]] == list(REPORTS[kind].row.model_fields)
    assert all(label for _, label in dataset["columns"])
    assert (dataset["totals"] is None) == (REPORTS[kind].totals is None)
