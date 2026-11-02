from pydantic import Field

from app.common.catalogue import MasterCreate, MasterResponse, MasterUpdate
from app.common.schemas import ApiModel, Money, Pagination


class AgencyTypeCreate(MasterCreate):
    maxDebt: Money


class AgencyTypeUpdate(MasterUpdate):
    maxDebt: Money = None


class AgencyTypeResponse(MasterResponse):
    maxDebt: Money
    agencyCount: int = Field(ge=0)
    activeAgencyCount: int = Field(ge=0)


class AgencyTypeListResponse(ApiModel):
    items: list[AgencyTypeResponse]
    pagination: Pagination
