from typing import Annotated

from pydantic import Field

from app.common.catalogue import PatchModel
from app.common.schemas import (
    ApiModel,
    BusinessDate,
    Id,
    NonEmptyText,
    NonZeroQuantity,
    NullableText,
)


class AdjustmentLineInput(ApiModel):
    productId: Id
    quantity: NonZeroQuantity


class StockAdjustmentCreate(ApiModel):
    businessDate: BusinessDate
    reason: NonEmptyText
    note: NullableText = None
    lines: list[AdjustmentLineInput] = []


class StockAdjustmentUpdate(PatchModel):
    businessDate: BusinessDate = None
    reason: NonEmptyText = None
    note: NullableText = None


class StockAdjustmentCorrection(ApiModel):
    businessDate: BusinessDate
    reason: NonEmptyText
    note: NullableText = None
    lines: Annotated[list[AdjustmentLineInput], Field(min_length=1)]
