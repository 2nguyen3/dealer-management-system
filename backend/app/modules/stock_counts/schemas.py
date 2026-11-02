from typing import Annotated, Literal

from pydantic import Field

from app.common.catalogue import PatchModel
from app.common.schemas import (
    ApiModel,
    CatalogId,
    Id,
    Instant,
    NonEmptyText,
    NullableInstant,
    NullableText,
    Pagination,
    Quantity,
    SignedQuantity,
)
from app.modules.document_core.schemas import Timestamps


class CountLineInput(ApiModel):
    productId: Id
    countedQuantity: Quantity


class StockCountCreate(ApiModel):
    countedAt: Instant
    reason: NullableText = None
    lines: list[CountLineInput] = []


class StockCountUpdate(PatchModel):
    countedAt: Instant = None
    reason: NullableText = None


class CountLineUpdate(ApiModel):
    countedQuantity: Quantity


class StockRecount(ApiModel):
    countedAt: Instant
    reason: NonEmptyText
    lines: Annotated[list[CountLineInput], Field(min_length=1)]


class StockCountLine(Timestamps):
    id: Id
    productId: Id
    productCode: str
    productName: str
    unitId: CatalogId
    unitName: str
    bookQuantity: Quantity = Field(json_schema_extra={"readOnly": True})
    countedQuantity: Quantity
    difference: SignedQuantity = Field(json_schema_extra={"readOnly": True})


class StockCount(Timestamps):
    id: Id
    code: Annotated[str, Field(pattern=r"^KK-[1-9][0-9]*$")]
    state: Literal["DRAFT", "CONFIRMED"]
    countedAt: Instant
    createdBy: Id
    confirmedBy: Id | None
    confirmedAt: NullableInstant
    adjustmentDocumentId: Id | None
    reason: NullableText
    lines: list[StockCountLine]


class StockCountList(ApiModel):
    items: list[StockCount]
    pagination: Pagination


class CountLineList(ApiModel):
    items: list[StockCountLine]
    pagination: Pagination
