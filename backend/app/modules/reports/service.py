from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ValidationError

from app.common.pagination import build_page, cursor_error
from app.core.exceptions import ApiError
from app.modules.reports.queries import IDENTITIES
from app.modules.reports.repository import ReportQueries
from app.modules.reports.schemas import (
    CollectionAmounts,
    CollectionsFilters,
    CollectionsReportResponse,
    CollectionsReportRow,
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


@dataclass(frozen=True)
class ReportSpec:
    filters: type[BaseModel]
    row: type[BaseModel]
    response: type[BaseModel]
    totals: type[BaseModel] | None
    sorts: tuple[str, ...]
    default_sort: str
    title: str


REPORTS = {
    "sales": ReportSpec(
        SalesFilters,
        SalesReportRow,
        SalesReportResponse,
        SalesTotals,
        ("agencyId", "salesAmount", "numberOfIssues"),
        "agencyId",
        "Báo cáo doanh số tháng",
    ),
    "debt": ReportSpec(
        DebtFilters,
        DebtReportRow,
        DebtReportResponse,
        DebtAmounts,
        ("agencyId", "closingDebt", "debtIncrease"),
        "agencyId",
        "Báo cáo công nợ tháng",
    ),
    "inventory": ReportSpec(
        InventoryFilters,
        InventoryReportRow,
        InventoryReportResponse,
        None,
        ("productId", "closingStock"),
        "productId",
        "Báo cáo tồn kho",
    ),
    "product-sales": ReportSpec(
        ProductSalesFilters,
        ProductSalesReportRow,
        ProductSalesReportResponse,
        ProductSalesTotals,
        ("productId", "salesAmount", "soldQuantity"),
        "-salesAmount",
        "Báo cáo doanh số theo mặt hàng",
    ),
    "collections": ReportSpec(
        CollectionsFilters,
        CollectionsReportRow,
        CollectionsReportResponse,
        CollectionAmounts,
        ("businessDate", "totalAmount"),
        "businessDate",
        "Báo cáo thu tiền",
    ),
}
COUNT_FIELDS = frozenset({"numberOfIssues", "receiptCount"})
# Human-readable export headers; API JSON keys are unchanged.
COLUMN_LABELS = {
    "agencyId": "Mã ĐL (ID)",
    "agencyCode": "Mã đại lý",
    "agencyName": "Tên đại lý",
    "productId": "Mã MH (ID)",
    "productCode": "Mã mặt hàng",
    "productName": "Tên mặt hàng",
    "unitId": "Mã ĐVT",
    "unitName": "Đơn vị tính",
    "numberOfIssues": "Số phiếu xuất",
    "salesAmount": "Tổng trị giá",
    "salesRate": "Tỷ lệ (%)",
    "openingDebt": "Nợ đầu kỳ",
    "debtIncrease": "Phát sinh",
    "paidAmount": "Đã trả",
    "closingDebt": "Nợ cuối kỳ",
    "openingStock": "Tồn đầu kỳ",
    "receiptQuantity": "Nhập",
    "issueQuantity": "Xuất",
    "closingStock": "Tồn cuối kỳ",
    "soldQuantity": "SL bán",
    "businessDate": "Ngày",
    "receiptCount": "Số phiếu thu",
    "cashAmount": "Tiền mặt",
    "bankTransferAmount": "Chuyển khoản",
    "onlineAmount": "Trực tuyến",
    "totalAmount": "Tổng tiền thu",
}


def identity_key(kind, row):
    value = getattr(row, IDENTITIES[kind])
    return value if isinstance(value, date) else int(value)


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
        spec = REPORTS[kind]
        try:
            interval = ReportInterval(fromDate=from_date, toDate=to_date)
            business_filters = spec.filters.model_validate({} if filters is None else filters)
        except ValidationError:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid report period or filters") from None
        filters = business_filters.model_dump()
        identifier = IDENTITIES[kind]
        identity_type = date if identifier == "businessDate" else int
        anchor = None
        if not export:
            sort = spec.default_sort if sort is None else sort
            if (
                not isinstance(sort, str)
                or sort not in (*spec.sorts, *("-" + field for field in spec.sorts))
                or type(limit) is not int
                or not 1 <= limit <= 100
            ):
                raise ApiError(422, "VALIDATION_FAILED", "Invalid report page controls")
            field = sort.removeprefix("-")
            scope = {"report": kind, **interval.model_dump(), "filters": filters, "sort": sort}
            if field == identifier:
                key_types = [identity_type]
            else:
                key_types = [int if field in COUNT_FIELDS else Decimal, identity_type]
            if cursor is not None:
                anchor = self.codec.decode(cursor, scope, key_types)

        detached = self.queries.read(kind, interval.fromDate, interval.toDate, filters)
        period = ReportPeriod(**interval.model_dump(), generatedAt=detached["generatedAt"])
        rows = [spec.row.model_validate(row) for row in detached["rows"]]
        totals = None
        if spec.totals is not None:
            # Integral money/counts: integer summation never rounds, whatever the size.
            values = {
                name: sum(int(getattr(row, name)) for row in rows)
                for name in spec.totals.model_fields
                if name != "companySalesAmount"
            }
            values = {
                name: value if name in COUNT_FIELDS else Decimal(value)
                for name, value in values.items()
            }
            if kind == "sales":
                values["companySalesAmount"] = detached["companySalesAmount"]
            totals = spec.totals.model_validate(values)
        if export:
            rows.sort(key=lambda row: identity_key(kind, row))
            return {
                "kind": kind,
                "title": spec.title,
                "period": period.model_dump(mode="json"),
                "filters": business_filters.model_dump(mode="json", exclude_none=True),
                "columns": [(key, COLUMN_LABELS.get(key, key)) for key in spec.row.model_fields],
                "rows": [row.model_dump(mode="json") for row in rows],
                "totals": None if totals is None else totals.model_dump(mode="json"),
            }

        def keys(row):
            identity = identity_key(kind, row)
            return (identity,) if field == identifier else (getattr(row, field), identity)

        descending = sort.startswith("-")
        rows.sort(key=keys, reverse=descending)
        if anchor is not None:
            if not any(keys(row) == anchor for row in rows):
                raise cursor_error()
            rows = [
                row for row in rows if (keys(row) < anchor if descending else keys(row) > anchor)
            ]
        items, pagination = build_page(rows, limit, self.codec, scope, keys)
        projection = dict(**period.model_dump(), items=items, pagination=pagination)
        if totals is not None:
            projection["totals"] = totals
        return spec.response.model_validate(projection)
