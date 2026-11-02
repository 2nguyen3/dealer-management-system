from typing import Annotated

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
    districtId: CatalogParameter | None = None


class InventoryFilters(ApiModel):
    productId: Id | None = None


class ProductSalesFilters(InventoryFilters):
    agencyId: Id | None = None


class CashCreditFilters(ApiModel):
    agencyId: Id | None = None


class ReportPeriod(ReportInterval):
    generatedAt: Instant


class AgencyReportIdentity(ApiModel):
    agencyId: Id
    agencyCode: Annotated[str, Field(strict=True)]
    agencyName: Annotated[str, Field(strict=True)]


class ProductReportIdentity(ApiModel):
    productId: Id
    productCode: Annotated[str, Field(strict=True)]
    productName: Annotated[str, Field(strict=True)]
    unitId: CatalogId
    unitName: Annotated[str, Field(strict=True)]


class ProductSalesTotals(ApiModel):
    salesAmount: AggregateMoney
    returnAmount: AggregateMoney
    netSalesAmount: SignedAggregateMoney


class SalesTotals(ProductSalesTotals):
    numberOfIssues: Annotated[int, Field(strict=True, ge=0)]
    companyGrossSales: AggregateMoney


class SalesReportRow(AgencyReportIdentity, ProductSalesTotals):
    numberOfIssues: Annotated[int, Field(strict=True, ge=0)]
    salesRate: Percentage


class DebtAmounts(ApiModel):
    openingDebt: AggregateMoney
    debtIncrease: AggregateMoney
    cashApplied: AggregateMoney
    returnsApplied: AggregateMoney
    creditApplied: AggregateMoney
    debtDecrease: AggregateMoney
    closingDebt: AggregateMoney


class DebtReportRow(AgencyReportIdentity, DebtAmounts):
    pass


class InventoryReportRow(ProductReportIdentity):
    openingStock: AggregateQuantity
    receiptQuantity: AggregateQuantity
    issueQuantity: AggregateQuantity
    returnQuantity: AggregateQuantity
    adjustmentQuantity: SignedAggregateQuantity
    closingStock: AggregateQuantity


class ProductSalesReportRow(ProductReportIdentity, ProductSalesTotals):
    soldQuantity: AggregateQuantity
    returnedQuantity: AggregateQuantity


class CashCreditAmounts(ApiModel):
    cashReceived: AggregateMoney
    cashRefunded: AggregateMoney
    verifiedUnreceiptedAmount: AggregateMoney
    openingCredit: AggregateMoney
    creditCreated: AggregateMoney
    creditApplied: AggregateMoney
    creditRefunded: AggregateMoney
    closingCredit: AggregateMoney
    currentReservedCredit: AggregateMoney
    currentAvailableCredit: AggregateMoney


class CashCreditReportRow(AgencyReportIdentity, CashCreditAmounts):
    pass


class SalesReportResponse(ReportPeriod):
    items: list[SalesReportRow]
    pagination: Pagination
    totals: SalesTotals


class DebtReportResponse(ReportPeriod):
    items: list[DebtReportRow]
    pagination: Pagination
    totals: DebtAmounts


class InventoryReportResponse(ReportPeriod):
    items: list[InventoryReportRow]
    pagination: Pagination


class ProductSalesReportResponse(ReportPeriod):
    items: list[ProductSalesReportRow]
    pagination: Pagination
    totals: ProductSalesTotals


class CashCreditReportResponse(ReportPeriod):
    items: list[CashCreditReportRow]
    pagination: Pagination
    totals: CashCreditAmounts
