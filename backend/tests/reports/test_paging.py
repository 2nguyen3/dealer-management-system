from datetime import date
from decimal import Decimal, localcontext
from unittest.mock import Mock

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from app.common.pagination import CursorCodec
from app.core.exceptions import ApiError
from app.modules.reports.queries import REPORT_SQL
from app.modules.reports.repository import ReportQueries
from app.modules.reports.service import REPORTS, SORTS, ReportService
from tests.reports.test_schemas import NOW, example_row

START, END = date(2026, 1, 1), date(2026, 2, 1)


def service_with_rows(kind, rows, company="400"):
    session = Mock()
    service = ReportService(session, CursorCodec(b"report-offline-test-key" * 2))
    assert service.session is session and service.queries.session is session
    service.queries = Mock()
    detached = {"generatedAt": NOW, "rows": rows}
    if kind == "sales":
        detached["companyGrossSales"] = Decimal(company)
    service.queries.read.return_value = detached
    return service


@pytest.mark.parametrize("kind", REPORTS)
def test_dispatch_totals_and_empty_metadata(kind):
    service = service_with_rows(kind, [])
    result = service.read(kind, START, END)
    assert type(result) is REPORTS[kind][2]
    assert result.items == [] and not result.pagination.hasMore
    assert result.generatedAt == NOW
    assert service.queries.read.call_count == 1
    if kind == "sales":
        assert result.totals.companyGrossSales == 400
        assert result.totals.salesAmount == 0
    if kind == "inventory":
        assert "totals" not in result.model_dump()


@pytest.mark.parametrize(
    ("kind", "sort"),
    [
        (kind, prefix + field)
        for kind, fields in SORTS.items()
        for field in fields
        for prefix in ("", "-")
    ],
)
def test_every_sort_and_tie_page(kind, sort):
    identifier = "productId" if kind in ("inventory", "product-sales") else "agencyId"
    rows = [example_row(kind, str(i)) for i in (2, 10, 1)]
    service = service_with_rows(kind, rows)
    first = service.read(kind, START, END, sort=sort, limit=1)
    second = service.read(kind, START, END, sort=sort, cursor=first.pagination.nextCursor, limit=1)
    third = service.read(kind, START, END, sort=sort, cursor=second.pagination.nextCursor, limit=1)
    expected = [10, 2, 1] if sort.startswith("-") else [1, 2, 10]
    assert [int(getattr(page.items[0], identifier)) for page in (first, second, third)] == expected
    assert not third.pagination.hasMore and third.pagination.nextCursor is None
    if kind != "inventory":
        assert first.totals == second.totals == third.totals


def test_numeric_sort_is_exact_and_totals_cover_full_population():
    big = 12345678901234567890123456789012345678901234567890
    rows = [
        example_row(
            "sales",
            str(i),
            salesAmount=Decimal(big + i),
            netSalesAmount=Decimal(big + i),
            numberOfIssues=1,
            salesRate="25",
        )
        for i in (1, 2, 10)
    ]
    service = service_with_rows("sales", rows, str(big * 4))
    with localcontext() as context:
        context.prec = 2
        page = service.read("sales", START, END, limit=1, sort="-salesAmount")
    assert page.items[0].agencyId == "10"
    assert page.totals.model_dump(mode="json")["salesAmount"] == str(big * 3 + 13)
    assert page.totals.numberOfIssues == 3
    assert page.totals.companyGrossSales == big * 4
    assert page.items[0].salesRate == 25


def test_product_default_is_descending_sales():
    service = service_with_rows(
        "product-sales",
        [
            example_row("product-sales", "1", salesAmount="1"),
            example_row("product-sales", "2", salesAmount="2"),
        ],
    )
    assert service.read("product-sales", START, END).items[0].productId == "2"


def test_hundred_row_page_limit_and_fractional_sort():
    service = service_with_rows(
        "inventory", [example_row("inventory", str(i)) for i in range(1, 102)]
    )
    first = service.read("inventory", START, END, limit=100)
    assert len(first.items) == 100 and first.pagination.hasMore
    last = service.read("inventory", START, END, limit=100, cursor=first.pagination.nextCursor)
    assert [row.productId for row in last.items] == ["101"]
    products = service_with_rows(
        "product-sales",
        [
            example_row("product-sales", "1", soldQuantity="0.01"),
            example_row("product-sales", "2", soldQuantity="0.001"),
            example_row("product-sales", "3", soldQuantity="1"),
        ],
    )
    assert [
        row.productId
        for row in products.read("product-sales", START, END, sort="soldQuantity").items
    ] == ["2", "1", "3"]


@pytest.mark.parametrize("kind", REPORTS)
def test_filter_validation_is_per_kind_including_export(kind):
    service = service_with_rows(kind, [])
    identifier = "productId" if kind in ("inventory", "product-sales") else "agencyId"
    for export in (False, True):
        with pytest.raises(ApiError):
            service.read(kind, START, END, filters={identifier: "0"}, export=export)
        with pytest.raises(ApiError):
            service.read(kind, START, END, filters={"unexpected": "1"}, export=export)
    service.queries.read.assert_not_called()
    dataset = service.read(kind, START, END, filters={identifier: "1"}, export=True)
    assert dataset["filters"] == {identifier: "1"}
    assert service.queries.read.call_args.args[3][identifier] == "1"


@pytest.mark.parametrize("kind", REPORTS)
def test_export_ignores_all_page_controls_and_has_no_cap(kind):
    rows = [example_row(kind, str(i)) for i in range(105, 0, -1)]
    service = service_with_rows(kind, rows)
    dataset = service.read(
        kind, START, END, cursor="stale-tampered", limit="bad", sort=object(), export=True
    )
    identifier = "productId" if kind in ("inventory", "product-sales") else "agencyId"
    assert len(dataset["rows"]) == 105
    assert [int(row[identifier]) for row in dataset["rows"]] == list(range(1, 106))
    assert dataset["kind"] == kind and dataset["period"]["generatedAt"] == NOW.isoformat()
    assert dataset["filters"] == {}
    assert all(isinstance(column, tuple) and len(column) == 2 for column in dataset["columns"])
    assert (dataset["totals"] is not None) == (kind != "inventory")
    assert service.queries.read.call_count == 1


@pytest.mark.parametrize("limit", [0, 101, "1", True, 1.0, None])
def test_json_invalid_limit_never_queries(limit):
    service = service_with_rows("sales", [])
    with pytest.raises(ApiError) as error:
        service.read("sales", START, END, limit=limit)
    assert error.value.status == 422
    service.queries.read.assert_not_called()


@pytest.mark.parametrize("sort", ["--agencyId", "salesRate", "agencyName", 1])
def test_json_invalid_sort_never_queries(sort):
    service = service_with_rows("sales", [])
    with pytest.raises(ApiError):
        service.read("sales", START, END, sort=sort)
    service.queries.read.assert_not_called()


def test_cursor_scope_tamper_and_anchor_changes():
    service = service_with_rows(
        "sales",
        [example_row("sales", "1", salesAmount="1"), example_row("sales", "2", salesAmount="2")],
    )
    first = service.read("sales", START, END, limit=1, sort="salesAmount")
    cursor = first.pagination.nextCursor
    for overrides in (
        {"cursor": "tampered"},
        {"sort": "-salesAmount"},
        {"filters": {"agencyId": "1"}},
        {"from_date": "2025-12-31"},
        {"kind": "debt"},
    ):
        arguments = dict(
            kind="sales", from_date=START, to_date=END, sort="salesAmount", cursor=cursor
        )
        arguments.update(overrides)
        with pytest.raises(ApiError) as error:
            service.read(**arguments)
        assert error.value.code == "INVALID_CURSOR" or error.value.status == 422
    service.queries.read.return_value["rows"][0]["salesAmount"] = "3"
    with pytest.raises(ApiError) as error:
        service.read("sales", START, END, cursor=cursor, sort="salesAmount")
    assert error.value.code == "INVALID_CURSOR"
    service.queries.read.return_value["rows"] = []
    with pytest.raises(ApiError):
        service.read("sales", START, END, cursor=cursor, sort="salesAmount")


@pytest.mark.parametrize("export", [False, True])
def test_business_validation_and_projection_failure(export):
    service = service_with_rows("sales", [])
    for arguments in (
        {"kind": "missing"},
        {"to_date": START},
        {"filters": {"productId": "1"}},
        {"filters": {"agencyId": "01"}},
    ):
        options = dict(kind="sales", from_date=START, to_date=END, export=export)
        options.update(arguments)
        with pytest.raises(ApiError) as error:
            service.read(**options)
        assert error.value.status == 422
    service.queries.read.assert_not_called()
    service.queries.read.side_effect = SQLAlchemyError("offline query failure")
    with pytest.raises(SQLAlchemyError):
        service.read("sales", START, END, export=export)
    service.queries.read.side_effect = None
    service.queries.read.return_value["rows"] = [example_row("sales", salesAmount=1.5)]
    with pytest.raises(ValidationError):
        service.read("sales", START, END, export=export)


@pytest.mark.parametrize("kind", REPORTS)
@pytest.mark.parametrize("empty", [False, True])
def test_repository_single_bound_statement_detaches_and_closes(kind, empty):
    session = Mock()
    identifier = "productId" if kind in ("inventory", "product-sales") else "agencyId"
    row = example_row(kind)
    row[identifier] = None if empty else 1
    row["__generatedAt"] = NOW
    if kind == "sales":
        row["__companyGrossSales"] = Decimal(400)
    session.execute.return_value.mappings.return_value = [row]
    queries = ReportQueries(session)
    method = getattr(queries, kind.replace("-", "_"))
    dataset = method(START, END, {identifier: "9223372036854775807"})
    assert dataset["generatedAt"] == NOW
    assert len(dataset["rows"]) == (0 if empty else 1)
    if not empty:
        assert dataset["rows"][0][identifier] == "1"
        assert not any(key.startswith("__") for key in dataset["rows"][0])
    statement, parameters = session.execute.call_args.args
    assert str(statement) == REPORT_SQL[kind]
    assert parameters[identifier] == 9223372036854775807
    assert parameters["fromDate"] == START and parameters["toDate"] == END
    assert "9223372036854775807" not in str(statement)
    session.execute.assert_called_once()
    session.execute.return_value.close.assert_called_once()
    session.commit.assert_not_called()
    session.rollback.assert_not_called()


@pytest.mark.parametrize("kind", REPORTS)
def test_repository_failures_close_results_without_transaction_side_effects(kind):
    session = Mock()
    result = session.execute.return_value
    result.mappings.side_effect = RuntimeError("materialization failed")
    method = getattr(ReportQueries(session), kind.replace("-", "_"))
    with pytest.raises(RuntimeError):
        method(START, END)
    result.close.assert_called_once()
    session.commit.assert_not_called()
    session.rollback.assert_not_called()
    session.execute.side_effect = SQLAlchemyError("query failed")
    with pytest.raises(SQLAlchemyError):
        method(START, END)
    with pytest.raises(KeyError):
        ReportQueries.statement("user SQL")


def test_sql_snapshot_and_source_guards():
    for statement in REPORT_SQL.values():
        assert 'statement_timestamp() AS "__generatedAt"' in statement
        assert "LEFT JOIN filtered f ON true" in statement
        assert " LIMIT " not in statement.upper()
        assert "FOR UPDATE" not in statement.upper()
        assert "numeric(18" not in statement
    sales = REPORT_SQL["sales"]
    # Rounded zero-amount returns remain genuine source activity.
    assert 'S."returnAmount"<>0' not in sales
    assert "raw AS MATERIALIZED" in sales and 'sum("salesAmount")' in sales
    assert sales.index("company AS") < sales.index("filtered AS")
    assert 'div(2*f."salesAmount"*1000000+company.gross,2*company.gross)*0.0001' in sales
    inventory = REPORT_SQL["inventory"]
    assert "d.status" not in inventory and 'd."currentRevisionId"' not in inventory
    assert "currentStock" not in inventory and "kind='STOCK_ISSUE'" in inventory
    product = REPORT_SQL["product-sales"]
    assert 'sum(l."lineAmount")' in product and "unitPrice" not in product
    cash = REPORT_SQL["cash-and-credit"]
    assert "Asia/Ho_Chi_Minh" in cash and 'u."receivedAt"' in cash
    assert "u.state='VERIFIED'" in cash and 'u."receiptDocumentId" IS NULL' in cash
    assert "x.state='ACTIVE'" in cash and "payment_event" not in cash
    assert 'l."sourceRevisionId"' not in cash
