"""Result tables for the web panel, copied from MCP tool results (never from the LLM).

Only list/report tools have a table; each declares its rows key and a fixed column set
(source key, output key, type). Output keys are the ones the UI already labels.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation

MAX_ROWS = 50
Column = tuple[str, str, str]  # (source key, output key, type)

AGENCY = (("code", "agencyCode", "code"), ("name", "agencyName", "text"))
PRODUCT = (("code", "productCode", "code"), ("name", "productName", "text"))
DOCUMENT = (
    ("code", "documentCode", "code"),
    ("kind", "kind", "kind"),
    ("businessDate", "businessDate", "date"),
    ("agencyName", "agencyName", "text"),
    ("status", "status", "status"),
    ("totalAmount", "documentAmount", "money"),
)


@dataclass(frozen=True)
class TableSpec:
    title: dict[str, str]
    columns: tuple[Column, ...]
    rows_key: str = "items"


TABLES: dict[str, TableSpec] = {
    "list_agencies": TableSpec(
        {"vi": "Đại lý", "en": "Agencies"},
        (
            *AGENCY,
            ("wardName", "wardName", "text"),
            ("typeName", "typeName", "text"),
            ("debt", "debt", "money"),
            ("maxDebt", "maxDebt", "money"),
        ),
    ),
    "list_products": TableSpec(
        {"vi": "Mặt hàng", "en": "Products"},
        (
            *PRODUCT,
            ("unitName", "unitName", "text"),
            ("stock", "stock", "quantity"),
            ("lastPurchasePrice", "lastPurchasePrice", "money"),
            ("sellingPrice", "sellingPrice", "money"),
        ),
    ),
    "search_documents": TableSpec({"vi": "Chứng từ", "en": "Documents"}, DOCUMENT),
    "list_stock_issues": TableSpec({"vi": "Phiếu xuất hàng", "en": "Stock issues"}, DOCUMENT),
    "list_stock_receipts": TableSpec({"vi": "Phiếu nhập hàng", "en": "Stock receipts"}, DOCUMENT),
    "list_payment_receipts": TableSpec(
        {"vi": "Phiếu thu tiền", "en": "Payment receipts"}, DOCUMENT
    ),
    "get_sales_report": TableSpec(
        {"vi": "Doanh số theo đại lý", "en": "Sales by agency"},
        (
            ("agencyCode", "agencyCode", "code"),
            ("agencyName", "agencyName", "text"),
            ("numberOfIssues", "numberOfIssues", "integer"),
            ("salesAmount", "salesAmount", "money"),
            ("salesRate", "salesRate", "rate"),
        ),
    ),
    "get_product_sales_report": TableSpec(
        {"vi": "Doanh số theo mặt hàng", "en": "Sales by product"},
        (
            ("productCode", "productCode", "code"),
            ("productName", "productName", "text"),
            ("unitName", "unitName", "text"),
            ("soldQuantity", "soldQuantity", "quantity"),
            ("salesAmount", "salesAmount", "money"),
        ),
    ),
    "get_debt_report": TableSpec(
        {"vi": "Công nợ đại lý trong kỳ", "en": "Agency debt in period"},
        (
            ("agencyCode", "agencyCode", "code"),
            ("agencyName", "agencyName", "text"),
            ("openingDebt", "openingDebt", "money"),
            ("debtIncrease", "debtIncrease", "money"),
            ("paidAmount", "paidAmount", "money"),
            ("closingDebt", "closingDebt", "money"),
        ),
    ),
    "get_inventory_report": TableSpec(
        {"vi": "Nhập xuất tồn trong kỳ", "en": "Stock movement in period"},
        (
            ("productCode", "productCode", "code"),
            ("productName", "productName", "text"),
            ("unitName", "unitName", "text"),
            ("openingStock", "openingStock", "quantity"),
            ("receiptQuantity", "receiptQuantity", "quantity"),
            ("issueQuantity", "issueQuantity", "quantity"),
            ("closingStock", "closingStock", "quantity"),
        ),
    ),
    "get_collections_report": TableSpec(
        {"vi": "Tiền thu theo ngày", "en": "Collections by day"},
        (
            ("businessDate", "businessDate", "date"),
            ("receiptCount", "receiptCount", "integer"),
            ("cashAmount", "cashAmount", "money"),
            ("bankTransferAmount", "bankTransferAmount", "money"),
            ("onlineAmount", "onlineAmount", "money"),
            ("totalAmount", "totalAmount", "money"),
        ),
    ),
}


def cell(value, kind: str):
    if value is None:
        return None
    if kind == "integer":
        try:
            return int(value)
        except (TypeError, ValueError):
            return None
    if kind in {"money", "quantity", "rate"}:
        try:
            number = Decimal(str(value))
        except InvalidOperation:
            return None
        if not number.is_finite():
            return None
        if number == number.to_integral_value():
            return str(number.quantize(Decimal(1)))
        return format(number.normalize(), "f")
    return str(value)[:400]


def build_table(tool: str, data, locale: str) -> dict | None:
    """A panel table from one successful tool result, or None for tools without one."""
    spec = TABLES.get(tool)
    if spec is None or not isinstance(data, dict):
        return None
    rows = data.get(spec.rows_key)
    if not isinstance(rows, list):
        return None
    rows = [row for row in rows if isinstance(row, dict)]
    pagination = data.get("pagination") if isinstance(data.get("pagination"), dict) else {}
    more = bool(pagination.get("hasMore") or pagination.get("nextCursor"))
    return {
        "title": spec.title["vi" if locale.startswith("vi") else "en"],
        "tool": tool,
        "columns": [{"key": key, "type": kind} for _, key, kind in spec.columns],
        "rows": [
            {key: cell(row.get(source), kind) for source, key, kind in spec.columns}
            for row in rows[:MAX_ROWS]
        ],
        "totalRows": len(rows),
        "truncated": more or len(rows) > MAX_ROWS,
        "asOf": str(data.get("generatedAt") or datetime.now(UTC).isoformat()),
    }
