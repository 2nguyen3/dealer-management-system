from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, Request, Response

from app.common.catalogue_http import CatalogSort, responses
from app.common.preconditions import read_preconditions
from app.common.schemas import CatalogParameter, Cursor, Limit, NonEmptyText
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.permissions.dependencies import get_function_service, get_permission_service
from app.modules.permissions.schemas import (
    FunctionListResponse,
    FunctionResponse,
    PermissionListResponse,
    PermissionResponse,
    PermissionSet,
)
from app.modules.permissions.service import FunctionService, PermissionService

router = APIRouter(tags=["Permissions"], route_class=BusinessRoute)
POLICY = {"allOf": ["permissions.manage"]}
Reader = Annotated[Principal, Depends(require_permissions(all_of=("permissions.manage",)))]
Functions = Annotated[FunctionService, Depends(get_function_service)]
Permissions = Annotated[PermissionService, Depends(get_permission_service)]


@router.get(
    "/functions",
    operation_id="listFunctions",
    response_model=FunctionListResponse,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": POLICY},
)
def list_functions(
    principal: Reader,
    service: Functions,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    code: NonEmptyText | None = None,
    sort: CatalogSort = "id",
):
    return service.list(limit=limit, cursor=cursor, q=q, code=code, sort=sort)


@router.get(
    "/functions/{functionId}",
    operation_id="getFunction",
    response_model=FunctionResponse,
    responses=responses(200, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": POLICY},
)
def get_function(functionId: CatalogParameter, principal: Reader, service: Functions):
    return service.get(functionId)


@router.get(
    "/user-groups/{groupId}/permissions",
    operation_id="listGroupPermissions",
    response_model=PermissionListResponse,
    responses=responses(200, 400, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": POLICY},
)
def list_group_permissions(
    groupId: CatalogParameter,
    principal: Reader,
    service: Permissions,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    isAllowed: bool | None = None,
    functionCode: NonEmptyText | None = None,
    sort: Literal["functionId", "-functionId", "id", "-id"] = "functionId",
):
    return service.list(
        groupId=groupId,
        limit=limit,
        cursor=cursor,
        isAllowed=isAllowed,
        functionCode=functionCode,
        sort=sort,
    )


@router.get(
    "/user-groups/{groupId}/permissions/{functionId}",
    operation_id="getGroupPermission",
    response_model=PermissionResponse,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": POLICY},
)
def get_group_permission(
    groupId: CatalogParameter,
    functionId: CatalogParameter,
    principal: Reader,
    service: Permissions,
    response: Response,
):
    item = service.get_pair(groupId, functionId)
    response.headers["ETag"] = service.etag(item)
    return item


@router.put(
    "/user-groups/{groupId}/permissions/{functionId}",
    operation_id="setGroupPermission",
    response_model=PermissionResponse,
    responses={
        **responses(200, 201, 400, 401, 403, 404, 412, 415, 422, 428, 429, 500, etag=True),
        201: {**responses(201, etag=True)[201], "model": PermissionResponse},
    },
    openapi_extra={"x-permissions": POLICY},
)
def set_group_permission(
    groupId: CatalogParameter,
    functionId: CatalogParameter,
    body: PermissionSet,
    principal: Reader,
    service: Permissions,
    request: Request,
    response: Response,
    match: Annotated[str | None, Header(alias="If-Match", pattern='^"[^"]+"$')] = None,
    none_match: Annotated[Literal["*"] | None, Header(alias="If-None-Match")] = None,
):
    item, created = service.set(
        groupId, functionId, body, read_preconditions(request, allow_create=True)
    )
    response.status_code = 201 if created else 200
    response.headers["ETag"] = service.etag(item)
    if created:
        response.headers["Location"] = f"/api/v1/user-groups/{groupId}/permissions/{functionId}"
    return item
