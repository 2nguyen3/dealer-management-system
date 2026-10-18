from decimal import Decimal
from typing import Literal

from pydantic import Field

from app.common.catalogue import PatchModel
from app.common.schemas import (
    ApiModel,
    BusinessDate,
    CatalogId,
    DerivedSellingPrice,
    Id,
    Instant,
    Money,
    NonEmptyText,
    Pagination,
    Quantity,
)


class ProductCreate(ApiModel):
    name: NonEmptyText
    unitId: CatalogId
    lowStockThreshold: Quantity = Decimal(0)
    status: Literal["ACTIVE", "INACTIVE"] = "ACTIVE"


class ProductUpdate(PatchModel):
    name: NonEmptyText = None
    unitId: CatalogId = None
    lowStockThreshold: Quantity = None
    status: Literal["ACTIVE", "INACTIVE"] = None


class PriceSource(ApiModel):
    documentId: Id
    documentCode: str
    revisionNo: int = Field(ge=1)
    lineId: Id
    businessDate: BusinessDate


class ProductResponse(ApiModel):
    id: Id
    code: str = Field(pattern=r"^MH-[1-9][0-9]*$", json_schema_extra={"readOnly": True})
    name: str
    unitId: CatalogId
    unitName: str
    allowsFraction: bool
    lowStockThreshold: Quantity
    status: Literal["ACTIVE", "INACTIVE"]
    currentStock: Quantity = Field(json_schema_extra={"readOnly": True})
    currentPurchasePrice: Money = Field(json_schema_extra={"readOnly": True})
    currentSellingPrice: DerivedSellingPrice = Field(json_schema_extra={"readOnly": True})
    priceSource: PriceSource | None
    isLowStock: bool
    createdAt: Instant = Field(json_schema_extra={"readOnly": True})
    updatedAt: Instant = Field(json_schema_extra={"readOnly": True})


class ProductListResponse(ApiModel):
    items: list[ProductResponse]
    pagination: Pagination
