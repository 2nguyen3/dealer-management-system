from typing import Annotated, Literal

from pydantic import Field

from app.common.schemas import (
    AggregateMoney,
    ApiModel,
    BusinessDate,
    Id,
    Instant,
    Money,
    Pagination,
    SignedMoney,
)
from app.modules.document_core.schemas import Timestamps


class CreditLot(Timestamps):
    id: Id
    agencyId: Id
    sourceDocumentId: Id
    sourceRevisionId: Id
    originReceiptId: Id
    balance: Money
    reserved: Money
    available: Money


class CreditLotList(ApiModel):
    items: list[CreditLot]
    pagination: Pagination


class CreditEntry(ApiModel):
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
    lotId: Id
    kind: Literal["CREATED", "REFUND", "OFFSET"]
    amountDelta: SignedMoney
    balanceAfter: AggregateMoney


class CreditStatement(ApiModel):
    agencyId: Id
    openingCredit: AggregateMoney
    closingCredit: AggregateMoney
    items: list[CreditEntry]
    pagination: Pagination
