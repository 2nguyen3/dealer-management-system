from pydantic import Field

from app.common.catalogue import MasterCreate, MasterResponse, MasterUpdate
from app.common.schemas import ApiModel, Pagination

DistrictCreate = MasterCreate
DistrictUpdate = MasterUpdate


class DistrictResponse(MasterResponse):
    activeAgencyCount: int = Field(ge=0)
    maxAgencies: int = Field(ge=1)
    remainingSlots: int = Field(ge=0)


class DistrictListResponse(ApiModel):
    items: list[DistrictResponse]
    pagination: Pagination
