from app.common.catalogue import PatchModel
from app.common.schemas import (
    ApiModel,
    BusinessDate,
    Id,
    NonEmptyText,
    NullableText,
    PositiveMoney,
    PositiveQuantity,
)


class ReceiptLineInput(ApiModel):
    productId: Id
    quantity: PositiveQuantity
    unitPrice: PositiveMoney


class StockReceiptCreate(ApiModel):
    businessDate: BusinessDate
    note: NullableText = None
    lines: list[ReceiptLineInput] = []


class StockHeaderUpdate(PatchModel):
    businessDate: BusinessDate = None
    note: NullableText = None


class Reason(ApiModel):
    reason: NonEmptyText
