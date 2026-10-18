from typing import Annotated, Literal

from pydantic import Field

from app.common.schemas import (
    AggregateMoney,
    ApiModel,
    BusinessDate,
    CatalogId,
    Id,
    Instant,
    Pagination,
    SignedMoney,
)
from app.modules.document_core.schemas import AgencyBalance, InvoiceBalance

ReceivableKind = Literal["CHARGE", "PAYMENT", "RETURN", "CREDIT"]
SettlementStatus = Literal["UNSETTLED", "PARTIAL", "SETTLED"]


class ReceivableOverview(AgencyBalance):
    agencyCode: str
    agencyName: str
    typeId: CatalogId
    districtId: CatalogId
    status: Literal["ACTIVE", "TERMINATED"]
    outstandingInvoiceCount: Annotated[int, Field(ge=0)]


class ReceivableTotals(ApiModel):
    currentDebt: AggregateMoney
    currentCredit: AggregateMoney
    reservedCredit: AggregateMoney
    availableCredit: AggregateMoney


class ReceivableOverviewList(ApiModel):
    asOf: Instant
    items: list[ReceivableOverview]
    pagination: Pagination
    totals: ReceivableTotals


class InvoiceBalanceList(ApiModel):
    items: list[InvoiceBalance]
    pagination: Pagination


class ReceivableEntry(ApiModel):
    id: Id
    sourceDocumentId: Id
    sourceDocumentCode: str
    sourceRevisionNo: Annotated[int, Field(ge=1)]
    businessDate: BusinessDate
    businessOrder: Id
    reversesEntryId: Id | None
    isEffective: bool
    createdAt: Instant
    agencyId: Id
    issueDocumentId: Id
    kind: ReceivableKind
    amountDelta: SignedMoney
    balanceAfter: AggregateMoney


class ReceivableStatement(ApiModel):
    agencyId: Id
    openingDebt: AggregateMoney
    closingDebt: AggregateMoney
    items: list[ReceivableEntry]
    pagination: Pagination


class AllocationList(ApiModel):
    items: list[ReceivableEntry]
    pagination: Pagination
