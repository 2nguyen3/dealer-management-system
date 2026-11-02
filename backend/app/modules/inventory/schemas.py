from typing import Annotated

from pydantic import Field

from app.common.schemas import (
    AggregateQuantity,
    ApiModel,
    BusinessDate,
    CatalogId,
    Id,
    Instant,
    NonZeroQuantity,
    Pagination,
)


class InventoryEntry(ApiModel):
    id: Id
    sourceDocumentId: Id
    sourceDocumentCode: str
    sourceRevisionNo: Annotated[int, Field(ge=1)]
    businessDate: BusinessDate
    businessOrder: Id
    reversesEntryId: Id | None
    isEffective: bool
    createdAt: Instant
    productId: Id
    unitId: CatalogId
    lineId: Id
    quantityDelta: NonZeroQuantity
    balanceAfter: AggregateQuantity


class InventoryStatement(ApiModel):
    productId: Id
    unitId: CatalogId
    openingStock: AggregateQuantity
    closingStock: AggregateQuantity
    items: list[InventoryEntry]
    pagination: Pagination
