from typing import Annotated

from pydantic import Field

from app.common.catalogue import PatchModel
from app.common.schemas import (
    ApiModel,
    BusinessDate,
    Id,
    Money,
    NonEmptyText,
    NullableText,
    PositiveMoney,
    PositiveQuantity,
    PriceRate,
)


class IssueLineInput(ApiModel):
    productId: Id
    quantity: PositiveQuantity


class StockIssueCreate(ApiModel):
    agencyId: Id
    businessDate: BusinessDate
    immediatePayment: Money = Field(default="0", validate_default=True)
    note: NullableText = None
    lines: list[IssueLineInput] = []


class StockIssueUpdate(PatchModel):
    businessDate: BusinessDate = None
    immediatePayment: Money = None
    note: NullableText = None


class PendingIssueRevision(ApiModel):
    businessDate: BusinessDate
    reason: NonEmptyText
    immediatePayment: Money
    note: NullableText = None
    lines: Annotated[list[IssueLineInput], Field(min_length=1)]


class IssueCorrectionLineInput(IssueLineInput):
    basePurchasePrice: PositiveMoney = None


class StockIssueCorrection(ApiModel):
    businessDate: BusinessDate
    reason: NonEmptyText
    note: NullableText = None
    sellingPriceRate: PriceRate = None
    lines: Annotated[list[IssueCorrectionLineInput], Field(min_length=1)]
