from pydantic import Field, StrictBool

from app.common.catalogue import MasterCreate, MasterResponse, MasterUpdate
from app.common.schemas import ApiModel, Pagination


class UnitCreate(MasterCreate):
    allowsFraction: StrictBool = False


class UnitUpdate(MasterUpdate):
    allowsFraction: StrictBool = None


class UnitResponse(MasterResponse):
    allowsFraction: bool
    productCount: int = Field(ge=0)


class UnitListResponse(ApiModel):
    items: list[UnitResponse]
    pagination: Pagination
