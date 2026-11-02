from typing import Annotated

from pydantic import Field

from app.common.schemas import (
    ApiModel,
    BusinessDate,
    Id,
    NonEmptyText,
    NullableText,
    PositiveQuantity,
)


class ReturnLineInput(ApiModel):
    originLineId: Id
    quantity: PositiveQuantity


class SalesReturnCreate(ApiModel):
    originDocumentId: Id
    businessDate: BusinessDate
    note: NullableText = None
    lines: list[ReturnLineInput] = []


class SalesReturnCorrection(ApiModel):
    businessDate: BusinessDate
    reason: NonEmptyText
    note: NullableText = None
    lines: Annotated[list[ReturnLineInput], Field(min_length=1)]
