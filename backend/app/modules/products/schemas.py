from typing import Literal

from pydantic import Field

from app.common.catalogue import PatchModel
from app.common.schemas import (
    ApiModel,
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
    status: Literal["ACTIVE", "INACTIVE"] = "ACTIVE"


class ProductUpdate(PatchModel):
    name: NonEmptyText = None
    unitId: CatalogId = None
    status: Literal["ACTIVE", "INACTIVE"] = None


class ProductResponse(ApiModel):
    id: Id
    code: str = Field(pattern=r"^MH-[1-9][0-9]*$", json_schema_extra={"readOnly": True})
    name: str
    unitId: CatalogId
    unitName: str
    allowsFraction: bool
    status: Literal["ACTIVE", "INACTIVE"]
    stock: Quantity = Field(json_schema_extra={"readOnly": True})
    lastPurchasePrice: Money | None = Field(json_schema_extra={"readOnly": True})
    sellingPrice: DerivedSellingPrice | None = Field(
        json_schema_extra={"readOnly": True},
        description="round(lastPurchasePrice × sellingPriceRate); null until first receipt.",
    )
    createdAt: Instant = Field(json_schema_extra={"readOnly": True})
    updatedAt: Instant = Field(json_schema_extra={"readOnly": True})


class ProductListResponse(ApiModel):
    items: list[ProductResponse]
    pagination: Pagination
