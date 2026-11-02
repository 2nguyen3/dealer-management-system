from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, Request, Response

from app.common.preconditions import read_preconditions
from app.common.responses import ERROR_SCHEMA
from app.common.schemas import CatalogParameter, Cursor, Limit, NonEmptyText
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.user_groups.dependencies import get_group_service
from app.modules.user_groups.schemas import (
    GroupCreate,
    GroupListResponse,
    GroupResponse,
    GroupUpdate,
)
from app.modules.user_groups.service import GroupService, group_etag

router = APIRouter(prefix="/user-groups", tags=["User Groups"], route_class=BusinessRoute)
READ_POLICY = {"anyOf": ["groups.manage", "users.manage", "permissions.manage"]}
WRITE_POLICY = {"allOf": ["groups.manage"]}
DELETE_POLICY = {"allOf": ["groups.manage", "permissions.manage"]}
Reader = Annotated[
    Principal,
    Depends(require_permissions(any_of=("groups.manage", "users.manage", "permissions.manage"))),
]
Writer = Annotated[Principal, Depends(require_permissions(all_of=("groups.manage",)))]
Deleter = Annotated[
    Principal, Depends(require_permissions(all_of=("groups.manage", "permissions.manage")))
]
CatalogSort = Literal["id", "-id", "code", "-code", "name", "-name"]
MatchHeader = Annotated[str, Header(alias="If-Match", pattern='^"[^"]+"$')]


def responses(*statuses: int, etag: bool = False) -> dict:
    result = {}
    for status in statuses:
        headers = {"X-Request-Id": {"schema": {"type": "string"}}}
        if status == 401:
            headers["WWW-Authenticate"] = {"schema": {"type": "string"}}
        if status == 429:
            headers["Retry-After"] = {"schema": {"type": "integer", "minimum": 1}}
        if status == 412 or (etag and status in (200, 201)):
            headers["ETag"] = {"schema": {"type": "string", "pattern": '^"[^"]+"$'}}
        if status == 201:
            headers["Location"] = {"schema": {"type": "string", "format": "uri-reference"}}
        result[status] = {"description": "Group response", "headers": headers}
        if status >= 400:
            result[status]["content"] = {"application/json": {"schema": ERROR_SCHEMA}}
    return result


Service = Annotated[GroupService, Depends(get_group_service)]


@router.get(
    "",
    operation_id="listUserGroups",
    response_model=GroupListResponse,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": READ_POLICY},
)
def list_groups(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    code: NonEmptyText | None = None,
    sort: CatalogSort = "id",
) -> GroupListResponse:
    return service.list(limit=limit, cursor=cursor, q=q, code=code, sort=sort)


@router.get(
    "/{groupId}",
    operation_id="getUserGroup",
    response_model=GroupResponse,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ_POLICY},
)
def get_group(
    groupId: CatalogParameter,
    principal: Reader,
    service: Service,
    response: Response,
) -> GroupResponse:
    result = service.get(groupId)
    response.headers["ETag"] = group_etag(result)
    return result


@router.post(
    "",
    operation_id="createUserGroup",
    status_code=201,
    response_model=GroupResponse,
    responses=responses(201, 400, 401, 403, 409, 415, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE_POLICY},
)
def create_group(
    body: GroupCreate,
    principal: Writer,
    service: Service,
    response: Response,
) -> GroupResponse:
    result = service.create(body)
    response.headers["ETag"] = group_etag(result)
    response.headers["Location"] = f"/api/v1/user-groups/{result.id}"
    return result


@router.patch(
    "/{groupId}",
    operation_id="updateUserGroup",
    response_model=GroupResponse,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE_POLICY},
)
def update_group(
    groupId: CatalogParameter,
    body: GroupUpdate,
    principal: Writer,
    service: Service,
    request: Request,
    response: Response,
    match: MatchHeader,
) -> GroupResponse:
    result = service.update(groupId, body, read_preconditions(request))
    response.headers["ETag"] = group_etag(result)
    return result


@router.delete(
    "/{groupId}",
    operation_id="deleteUserGroup",
    status_code=204,
    responses=responses(204, 401, 403, 404, 409, 412, 422, 428, 429, 500),
    openapi_extra={"x-permissions": DELETE_POLICY},
)
def delete_group(
    groupId: CatalogParameter,
    principal: Deleter,
    service: Service,
    request: Request,
    match: MatchHeader,
) -> Response:
    service.delete(groupId, read_preconditions(request))
    return Response(status_code=204)
