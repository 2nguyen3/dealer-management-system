"""Semantic model (D3): the only metrics, fields, operators and sorts the assistant may use.

See openwiki/backend-design/plan/chatbot/CONTRACT.md -> Semantic model. Each variant maps
one (metric, period?, groupBy) combination to a trusted reader; no SQL is ever generated.
"""

from dataclasses import dataclass
from typing import Literal

FieldKind = Literal["entity", "money", "quantity", "integer"]
ColumnType = Literal["code", "text", "money", "quantity", "integer", "rate"]
Entity = Literal["agency", "product", "ward", "agencyType"]

COMPARE = ("eq", "gt", "gte", "lt", "lte")

# Same policy as listProducts (current stock is visible there).
PRODUCT_READERS = (
    "product.manage",
    "stock.receipt.prepare",
    "stock.receipt.post",
    "stock.issue.prepare",
    "stock.issue.post",
    "sales.read",
    "reports.read",
)
# Endpoint admission: the union of every metric permission.
ADMISSION = (
    "debt.read",
    "sales.read",
    "reports.read",
    "product.manage",
    "stock.receipt.prepare",
    "stock.receipt.post",
    "stock.issue.prepare",
    "stock.issue.post",
)


@dataclass(frozen=True)
class Field:
    kind: FieldKind
    entity: Entity | None = None
    label: str = ""

    @property
    def ops(self) -> tuple[str, ...]:
        return ("eq",) if self.kind == "entity" else COMPARE


AGENCY = Field("entity", "agency", "agency code or name")
WARD = Field("entity", "ward", "ward/commune name")
AGENCY_TYPE = Field("entity", "agencyType", "agency type code or name")
PRODUCT = Field("entity", "product", "product code or name")


@dataclass(frozen=True)
class Variant:
    key: str
    metric: Literal["DEBT", "INVENTORY", "SALES"]
    grain: Literal["agency", "product"]
    period: bool
    reader: str
    any_of: tuple[str, ...]
    fields: dict[str, Field]
    sorts: tuple[str, ...]
    default_sort: str
    columns: tuple[tuple[str, ColumnType], ...]
    source: str
    title: dict[str, str]


VARIANTS: tuple[Variant, ...] = (
    Variant(
        key="debt.current",
        metric="DEBT",
        grain="agency",
        period=False,
        reader="agency_debt",
        any_of=("debt.read",),
        fields={
            "agency": AGENCY,
            "ward": WARD,
            "agencyType": AGENCY_TYPE,
            "debt": Field("money", label="current debt (VND)"),
        },
        sorts=("debt", "agencyCode"),
        default_sort="-debt",
        columns=(
            ("agencyCode", "code"),
            ("agencyName", "text"),
            ("wardName", "text"),
            ("debt", "money"),
        ),
        source="listAgencies",
        title={"vi": "Dư nợ hiện tại của đại lý", "en": "Current agency debt"},
    ),
    Variant(
        key="debt.period",
        metric="DEBT",
        grain="agency",
        period=True,
        reader="debt",
        any_of=("debt.read",),
        fields={
            "agency": AGENCY,
            "ward": WARD,
            "agencyType": AGENCY_TYPE,
            "closingDebt": Field("money", label="closing debt (VND)"),
            "debtIncrease": Field("money", label="debt increase in period (VND)"),
        },
        sorts=("closingDebt", "debtIncrease", "agencyCode"),
        default_sort="-closingDebt",
        columns=(
            ("agencyCode", "code"),
            ("agencyName", "text"),
            ("openingDebt", "money"),
            ("debtIncrease", "money"),
            ("paidAmount", "money"),
            ("closingDebt", "money"),
        ),
        source="getDebtReport",
        title={"vi": "Công nợ đại lý trong kỳ", "en": "Agency debt in period"},
    ),
    Variant(
        key="inventory.current",
        metric="INVENTORY",
        grain="product",
        period=False,
        reader="product_stock",
        any_of=PRODUCT_READERS,
        fields={"product": PRODUCT, "stock": Field("quantity", label="current stock")},
        sorts=("stock", "productCode"),
        default_sort="productCode",
        columns=(
            ("productCode", "code"),
            ("productName", "text"),
            ("unitName", "text"),
            ("stock", "quantity"),
        ),
        source="listProducts",
        title={"vi": "Tồn kho hiện tại", "en": "Current stock"},
    ),
    Variant(
        key="inventory.period",
        metric="INVENTORY",
        grain="product",
        period=True,
        reader="inventory",
        any_of=("reports.read",),
        fields={
            "product": PRODUCT,
            "closingStock": Field("quantity", label="closing stock"),
        },
        sorts=("closingStock", "productCode"),
        default_sort="productCode",
        columns=(
            ("productCode", "code"),
            ("productName", "text"),
            ("unitName", "text"),
            ("openingStock", "quantity"),
            ("receiptQuantity", "quantity"),
            ("issueQuantity", "quantity"),
            ("closingStock", "quantity"),
        ),
        source="getInventoryReport",
        title={"vi": "Nhập xuất tồn trong kỳ", "en": "Stock movement in period"},
    ),
    Variant(
        key="sales.agency",
        metric="SALES",
        grain="agency",
        period=True,
        reader="sales",
        any_of=("sales.read",),
        fields={
            "agency": AGENCY,
            "agencyType": AGENCY_TYPE,
            "salesAmount": Field("money", label="sales amount (VND)"),
            "numberOfIssues": Field("integer", label="number of stock issues"),
        },
        sorts=("salesAmount", "numberOfIssues", "agencyCode"),
        default_sort="-salesAmount",
        columns=(
            ("agencyCode", "code"),
            ("agencyName", "text"),
            ("numberOfIssues", "integer"),
            ("salesAmount", "money"),
            ("salesRate", "rate"),
        ),
        source="getSalesReport",
        title={"vi": "Doanh số theo đại lý", "en": "Sales by agency"},
    ),
    Variant(
        key="sales.product",
        metric="SALES",
        grain="product",
        period=True,
        reader="product-sales",
        any_of=("sales.read",),
        fields={
            "agency": AGENCY,
            "product": PRODUCT,
            "salesAmount": Field("money", label="sales amount (VND)"),
            "soldQuantity": Field("quantity", label="sold quantity"),
        },
        sorts=("salesAmount", "soldQuantity", "productCode"),
        default_sort="-salesAmount",
        columns=(
            ("productCode", "code"),
            ("productName", "text"),
            ("unitName", "text"),
            ("numberOfIssues", "integer"),
            ("soldQuantity", "quantity"),
            ("salesAmount", "money"),
        ),
        source="getProductSalesReport",
        title={"vi": "Doanh số theo mặt hàng", "en": "Sales by product"},
    ),
)

METRIC_TEXT = {
    "DEBT": "agency debt: current balance (no period) or opening/increase/paid/closing in a period",
    "INVENTORY": "product stock: current stock (no period) or receipts/issues/closing in a period",
    "SALES": "sales of POSTED stock issues in a period (required), by agency or by product",
}


def variant_for(metric: str, has_period: bool, group_by: str | None) -> Variant | None:
    """The variant answering a query shape, or None when the shape is unsupported."""
    for variant in VARIANTS:
        if variant.metric != metric:
            continue
        if metric == "SALES":
            if variant.grain == (group_by or "agency"):
                return variant
        elif variant.period == has_period and group_by in (None, variant.grain):
            return variant
    return None
