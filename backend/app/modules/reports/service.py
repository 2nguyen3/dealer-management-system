from decimal import Decimal

from pydantic import ValidationError

from app.common.pagination import build_page, cursor_error
from app.core.exceptions import ApiError
from app.modules.reports.repository import ReportQueries
from app.modules.reports.schemas import (
    CashCreditAmounts,
    CashCreditFilters,
    CashCreditReportResponse,
    CashCreditReportRow,
    DebtAmounts,
    DebtFilters,
    DebtReportResponse,
    DebtReportRow,
    InventoryFilters,
    InventoryReportResponse,
    InventoryReportRow,
    ProductSalesFilters,
    ProductSalesReportResponse,
    ProductSalesReportRow,
    ProductSalesTotals,
    ReportInterval,
    ReportPeriod,
    SalesFilters,
    SalesReportResponse,
    SalesReportRow,
    SalesTotals,
)

REPORTS = {
    "sales": (SalesFilters, SalesReportRow, SalesReportResponse, SalesTotals),
    "debt": (DebtFilters, DebtReportRow, DebtReportResponse, DebtAmounts),
    "inventory": (InventoryFilters, InventoryReportRow, InventoryReportResponse, None),
    "product-sales": (
        ProductSalesFilters,
        ProductSalesReportRow,
        ProductSalesReportResponse,
        ProductSalesTotals,
    ),
    "cash-and-credit": (
        CashCreditFilters,
        CashCreditReportRow,
        CashCreditReportResponse,
        CashCreditAmounts,
    ),
}
SORTS = {
    "sales": ("agencyId", "salesAmount", "netSalesAmount"),
    "debt": ("agencyId", "closingDebt"),
    "inventory": ("productId", "closingStock"),
    "product-sales": ("productId", "salesAmount", "soldQuantity"),
    "cash-and-credit": ("agencyId", "cashReceived", "closingCredit"),
}
TITLES = {
    "sales": "Sales report",
    "debt": "Debt report",
    "inventory": "Inventory report",
    "product-sales": "Product sales report",
    "cash-and-credit": "Cash and credit report",
}


class ReportService:
    """Projection/page construction only; each HTTP consumer must authorize first."""

    def __init__(self, session, codec):
        self.session = session
        self.queries = ReportQueries(session)
        self.codec = codec

    def read(
        self, kind, from_date, to_date, filters=None, cursor=None, limit=25, sort=None, export=False
    ):
        if kind not in REPORTS:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid report kind")
        filter_model, row_model, response_model, total_model = REPORTS[kind]
        try:
            interval = ReportInterval(fromDate=from_date, toDate=to_date)
            business_filters = filter_model.model_validate({} if filters is None else filters)
        except ValidationError:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid report period or filters") from None
        filters = business_filters.model_dump()
        identifier = "productId" if kind in ("inventory", "product-sales") else "agencyId"
        anchor = None
        if not export:
            sort = (
                sort
                if sort is not None
                else ("-salesAmount" if kind == "product-sales" else identifier)
            )
            if (
                not isinstance(sort, str)
                or sort not in (*SORTS[kind], *("-" + field for field in SORTS[kind]))
                or type(limit) is not int
                or not 1 <= limit <= 100
            ):
                raise ApiError(422, "VALIDATION_FAILED", "Invalid report page controls")
            field = sort.removeprefix("-")
            scope = {"report": kind, **interval.model_dump(), "filters": filters, "sort": sort}
            key_types = [int] if field == identifier else [Decimal, int]
            if cursor is not None:
                anchor = self.codec.decode(cursor, scope, key_types)

        detached = self.queries.read(kind, interval.fromDate, interval.toDate, filters)
        period = ReportPeriod(**interval.model_dump(), generatedAt=detached["generatedAt"])
        rows = [row_model.model_validate(row) for row in detached["rows"]]
        totals = None
        if total_model is not None:
            # All total fields are integral money/counts. Integer summation avoids
            # Decimal's default context rounding even for arbitrarily large sums.
            values = {
                name: Decimal(sum(int(getattr(row, name)) for row in rows))
                for name in total_model.model_fields
                if name not in ("companyGrossSales", "numberOfIssues")
            }
            if kind == "sales":
                values.update(
                    numberOfIssues=sum(row.numberOfIssues for row in rows),
                    companyGrossSales=detached["companyGrossSales"],
                )
            totals = total_model.model_validate(values)
        if export:
            rows.sort(key=lambda row: int(getattr(row, identifier)))
            dataset = {
                "kind": kind,
                "title": TITLES[kind],
                "period": period.model_dump(mode="json"),
                "filters": business_filters.model_dump(mode="json", exclude_none=True),
                "columns": [(key, key) for key in row_model.model_fields],
                "rows": [row.model_dump(mode="json") for row in rows],
                "totals": None if totals is None else totals.model_dump(mode="json"),
            }
            return dataset

        def keys(row):
            identity = int(getattr(row, identifier))
            return (identity,) if field == identifier else (getattr(row, field), identity)

        rows.sort(key=keys, reverse=sort.startswith("-"))
        if anchor is not None:
            if not any(keys(row) == anchor for row in rows):
                raise cursor_error()
            rows = [
                row
                for row in rows
                if (keys(row) < anchor if sort.startswith("-") else keys(row) > anchor)
            ]
        items, pagination = build_page(rows, limit, self.codec, scope, keys)
        projection = dict(**period.model_dump(), items=items, pagination=pagination)
        if totals is not None:
            projection["totals"] = totals
        return response_model.model_validate(projection)
