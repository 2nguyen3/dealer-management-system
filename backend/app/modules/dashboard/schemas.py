from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, Field, PlainSerializer, PlainValidator, model_serializer
from pydantic.json_schema import SkipJsonSchema, WithJsonSchema

from app.common.schemas import (
    AggregateMoney,
    ApiModel,
    Id,
    Instant,
    Money,
    SignedMoney,
)
from app.common.values import format_number
from app.modules.reports.schemas import ProductSalesReportRow


def validate_month(value: str) -> str:
    if value[:4] == "0000":
        raise ValueError("A positive calendar year is required")
    return value


def validate_ratio(value: object) -> Decimal:
    if not isinstance(value, Decimal) or not value.is_finite() or value < 0:
        raise ValueError("A nonnegative exact ratio is required")
    if value != round(value, 2):
        raise ValueError("Ratios carry at most two decimals")
    return value


Month = Annotated[
    str,
    Field(strict=True, pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$"),
    AfterValidator(validate_month),
]
Count = Annotated[int, Field(strict=True, ge=0)]
# Debt as a percentage of the type limit, half-up to 2 decimals; may exceed 100 when a
# cancelled payment or a lowered limit leaves an agency over its limit (QĐ7).
DebtRatio = Annotated[
    Decimal,
    PlainValidator(validate_ratio),
    PlainSerializer(lambda value: format_number(value, kind="AggregateQuantity"), return_type=str),
    WithJsonSchema({"type": "string", "pattern": r"^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$"}),
]


class DashboardAgencies(ApiModel):
    total: Count
    active: Count


class MonthlySalesPoint(ApiModel):
    month: Month
    salesAmount: AggregateMoney
    issueCount: Count


class DashboardSales(ApiModel):
    salesAmount: AggregateMoney
    issueCount: Count
    monthlyTrend: Annotated[list[MonthlySalesPoint], Field(max_length=12)]
    topProducts: Annotated[list[ProductSalesReportRow], Field(max_length=10)]


class DashboardCollections(ApiModel):
    receiptCount: Count
    totalAmount: AggregateMoney
    cashAmount: AggregateMoney
    bankTransferAmount: AggregateMoney
    onlineAmount: AggregateMoney


class AgencyDebtPoint(ApiModel):
    agencyId: Id
    agencyCode: str
    agencyName: str
    debt: SignedMoney
    maxDebt: Money
    # Null when the limit is zero: any debt is then over the limit (listed first).
    debtRatio: Annotated[DebtRatio | None, WithJsonSchema({"type": ["string", "null"]})]


class DashboardDebt(ApiModel):
    # Current balances (agency.debt), independent of the selected month.
    totalDebt: AggregateMoney
    prepaidAmount: AggregateMoney
    agenciesInDebt: Count
    topAgencies: Annotated[list[AgencyDebtPoint], Field(max_length=10)]


class DashboardDrafts(ApiModel):
    """Current draft counts; each kind appears only for its preparers/posters."""

    stockReceipts: Count | SkipJsonSchema[None] = None
    stockIssues: Count | SkipJsonSchema[None] = None
    paymentReceipts: Count | SkipJsonSchema[None] = None

    @model_serializer(mode="wrap")
    def projected(self, handler):
        return {key: value for key, value in handler(self).items() if value is not None}


class DashboardResponse(ApiModel):
    month: Month
    asOf: Instant
    agencies: DashboardAgencies | SkipJsonSchema[None] = None
    sales: DashboardSales | SkipJsonSchema[None] = None
    collections: DashboardCollections | SkipJsonSchema[None] = None
    debt: DashboardDebt | SkipJsonSchema[None] = None
    drafts: DashboardDrafts | SkipJsonSchema[None] = None

    @model_serializer(mode="wrap")
    def projected(self, handler):
        return {key: value for key, value in handler(self).items() if value is not None}
