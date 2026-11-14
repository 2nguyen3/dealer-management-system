"""Report contracts for the simplified model (handoff 3.4).

Every figure is a plain sum over POSTED documents; drafts and cancelled documents never
count. Periods are the half-open business-date interval ``[fromDate, toDate)``.
"""

from typing import Annotated, Literal

from pydantic import Field, model_validator

from app.common.dates import validate_range
from app.common.schemas import (
    AggregateMoney,
    AggregateQuantity,
    ApiModel,
    BusinessDate,
    CatalogId,
    CatalogParameter,
    Id,
    Instant,
    Pagination,
    Percentage,
    SignedAggregateMoney,
    SignedAggregateQuantity,
)

Count = Annotated[int, Field(strict=True, ge=0)]
Text = Annotated[str, Field(strict=True)]
ReceiptType = Literal["CASH", "BANK_TRANSFER", "ONLINE"]


class ReportInterval(ApiModel):
    fromDate: BusinessDate
    toDate: BusinessDate

    @model_validator(mode="after")
    def valid_interval(self):
        validate_range(self.fromDate, self.toDate)
        return self


class SalesFilters(ApiModel):
    agencyId: Id | None = None
    typeId: CatalogParameter | None = None


class DebtFilters(SalesFilters):
    wardId: CatalogParameter | None = None


class InventoryFilters(ApiModel):
    productId: Id | None = None


class ProductSalesFilters(InventoryFilters):
    agencyId: Id | None = None


class CollectionsFilters(ApiModel):
    agencyId: Id | None = None
    receiptType: ReceiptType | None = None


class ReportPeriod(ReportInterval):
    generatedAt: Instant


class AgencyReportIdentity(ApiModel):
    agencyId: Id
    agencyCode: Text
    agencyName: Text


class ProductReportIdentity(ApiModel):
    productId: Id
    productCode: Text
    productName: Text
    unitId: CatalogId
    unitName: Text


# ------------------------------------------------------------ BM5.1 sales ----


class SalesReportRow(AgencyReportIdentity):
    numberOfIssues: Count
    salesAmount: AggregateMoney
    salesRate: Percentage


class SalesTotals(ApiModel):
    numberOfIssues: Count
    salesAmount: AggregateMoney
    # Whole-company total of the period: the denominator of salesRate, even when filtered.
    companySalesAmount: AggregateMoney


class SalesReportResponse(ReportPeriod):
    items: list[SalesReportRow]
    pagination: Pagination
    totals: SalesTotals


# ------------------------------------------------------------- BM5.2 debt ----


class DebtAmounts(ApiModel):
    # Debt may be negative: a late verified online payment is a prepayment (3.3).
    openingDebt: SignedAggregateMoney
    debtIncrease: AggregateMoney
    paidAmount: AggregateMoney
    closingDebt: SignedAggregateMoney


class DebtReportRow(AgencyReportIdentity):
    openingDebt: SignedAggregateMoney
    debtIncrease: AggregateMoney
    paidAmount: AggregateMoney
    closingDebt: SignedAggregateMoney


class DebtReportResponse(ReportPeriod):
    items: list[DebtReportRow]
    pagination: Pagination
    totals: DebtAmounts


# -------------------------------------------------------------- inventory ----


class InventoryReportRow(ProductReportIdentity):
    # Backdated documents can make a historical running balance negative.
    openingStock: SignedAggregateQuantity
    receiptQuantity: AggregateQuantity
    issueQuantity: AggregateQuantity
    closingStock: SignedAggregateQuantity


class InventoryReportResponse(ReportPeriod):
    items: list[InventoryReportRow]
    pagination: Pagination


# ---------------------------------------------------------- product sales ----


class ProductSalesReportRow(ProductReportIdentity):
    numberOfIssues: Count
    soldQuantity: AggregateQuantity
    salesAmount: AggregateMoney


class ProductSalesTotals(ApiModel):
    salesAmount: AggregateMoney


class ProductSalesReportResponse(ReportPeriod):
    items: list[ProductSalesReportRow]
    pagination: Pagination
    totals: ProductSalesTotals


# ------------------------------------------------------------ collections ----


class CollectionAmounts(ApiModel):
    receiptCount: Count
    cashAmount: AggregateMoney
    bankTransferAmount: AggregateMoney
    onlineAmount: AggregateMoney
    totalAmount: AggregateMoney


class CollectionsReportRow(ApiModel):
    businessDate: BusinessDate
    receiptCount: Count
    cashAmount: AggregateMoney
    bankTransferAmount: AggregateMoney
    onlineAmount: AggregateMoney
    totalAmount: AggregateMoney


class CollectionsReportResponse(ReportPeriod):
    items: list[CollectionsReportRow]
    pagination: Pagination
    totals: CollectionAmounts
