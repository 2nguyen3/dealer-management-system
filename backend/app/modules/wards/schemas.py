from typing import Literal

from pydantic import Field

from app.common.schemas import ApiModel, CatalogId, Instant, Pagination

WardKind = Literal["WARD", "COMMUNE", "SPECIAL_ZONE"]


class WardResponse(ApiModel):
    id: CatalogId
    code: str = Field(pattern=r"^[0-9]{5}$")
    name: str
    kind: WardKind
    activeAgencyCount: int = Field(ge=0)
    maxAgencies: int = Field(ge=1)
    remainingSlots: int = Field(ge=0)
    createdAt: Instant = Field(json_schema_extra={"readOnly": True})
    updatedAt: Instant = Field(json_schema_extra={"readOnly": True})


class WardListResponse(ApiModel):
    items: list[WardResponse]
    pagination: Pagination
