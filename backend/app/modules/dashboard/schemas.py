from typing import Annotated

from pydantic import AfterValidator, Field, model_serializer
from pydantic.json_schema import SkipJsonSchema

from app.common.schemas import (
    AggregateMoney,
    ApiModel,
    Id,
    Instant,
    Money,
    SignedAggregateMoney,
)
from app.modules.reports.schemas import ProductSalesReportRow


def validate_month(value: str) -> str:
    if value[:4] == "0000":
        raise ValueError("A positive calendar year is required")
    return value


Month = Annotated[
    str,
    Field(strict=True, pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$"),
    AfterValidator(validate_month),
]
Count = Annotated[int, Field(strict=True, ge=0)]


class DashboardAgencies(ApiModel):
    total: Count
    active: Count


class DashboardInventory(ApiModel):
    productCount: Count
    lowStockProductCount: Count
    receivedAmount: AggregateMoney


class MonthlySalesPoint(ApiModel):
    month: Month
    gross: AggregateMoney
    returns: AggregateMoney
    net: SignedAggregateMoney


class AgencyDebtPoint(ApiModel):
    agencyId: Id
    agencyCode: str
    agencyName: str
    currentDebt: Money


class DashboardSales(ApiModel):
    gross: AggregateMoney
    returns: AggregateMoney
    net: SignedAggregateMoney
    monthlyTrend: Annotated[list[MonthlySalesPoint], Field(max_length=12)]
    topProducts: Annotated[list[ProductSalesReportRow], Field(max_length=10)]


class DashboardReceivables(ApiModel):
    currentDebt: AggregateMoney
    currentCredit: AggregateMoney
    cashReceived: AggregateMoney
    cashRefunded: AggregateMoney
    topAgencies: Annotated[list[AgencyDebtPoint], Field(max_length=10)]


class DashboardResponse(ApiModel):
    month: Month
    asOf: Instant
    agencies: DashboardAgencies | SkipJsonSchema[None] = None
    inventory: DashboardInventory | SkipJsonSchema[None] = None
    sales: DashboardSales | SkipJsonSchema[None] = None
    receivables: DashboardReceivables | SkipJsonSchema[None] = None
    pendingIssueCount: Count | SkipJsonSchema[None] = None
    verifiedUnreceiptedAmount: AggregateMoney | SkipJsonSchema[None] = None

    @model_serializer(mode="wrap")
    def projected(self, handler):
        return {key: value for key, value in handler(self).items() if value is not None}
