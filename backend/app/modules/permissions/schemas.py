from pydantic import Field, StrictBool

from app.common.schemas import ApiModel, CatalogId, Id, Instant, Pagination
from app.modules.auth.permissions import FunctionCode


class FunctionResponse(ApiModel):
    id: CatalogId
    code: FunctionCode
    name: str
    createdAt: Instant = Field(json_schema_extra={"readOnly": True})
    updatedAt: Instant = Field(json_schema_extra={"readOnly": True})


class FunctionListResponse(ApiModel):
    items: list[FunctionResponse]
    pagination: Pagination


class PermissionSet(ApiModel):
    isAllowed: StrictBool


class PermissionResponse(ApiModel):
    id: Id
    groupId: CatalogId
    functionId: CatalogId
    functionCode: FunctionCode
    functionName: str
    isAllowed: bool
    createdAt: Instant = Field(json_schema_extra={"readOnly": True})
    updatedAt: Instant = Field(json_schema_extra={"readOnly": True})


class PermissionListResponse(ApiModel):
    items: list[PermissionResponse]
    pagination: Pagination
