from typing import Annotated, Literal

from pydantic import Field

from app.common.schemas import (
    ApiModel,
    Id,
    NonZeroQuantity,
    Pagination,
    PositiveMoney,
    PositiveQuantity,
)
from app.modules.document_core.schemas import DocumentLine, Revision


class ReceiptLine(ApiModel):
    kind: Literal["STOCK_RECEIPT"]
    productId: Id
    quantity: PositiveQuantity
    unitPrice: PositiveMoney


class IssueLine(ApiModel):
    kind: Literal["STOCK_ISSUE"]
    productId: Id
    quantity: PositiveQuantity


class AdjustmentLine(ApiModel):
    kind: Literal["STOCK_ADJUSTMENT"]
    productId: Id
    quantity: NonZeroQuantity


class ReturnLine(ApiModel):
    kind: Literal["SALES_RETURN"]
    originLineId: Id
    quantity: PositiveQuantity


GoodsLine = Annotated[
    ReceiptLine | IssueLine | AdjustmentLine | ReturnLine, Field(discriminator="kind")
]


class RevisionList(ApiModel):
    items: list[Revision]
    pagination: Pagination


class LineList(ApiModel):
    items: list[DocumentLine]
    pagination: Pagination
