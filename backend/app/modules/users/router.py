from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request, Response

from app.common.catalogue_http import MatchHeader, responses
from app.common.preconditions import read_preconditions
from app.common.schemas import CatalogParameter, Cursor, Id, Limit, NonEmptyText
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.schemas import UserResponse
from app.modules.auth.service import Principal
from app.modules.users.dependencies import get_user_service
from app.modules.users.schemas import AdminPasswordReset, UserCreate, UserListResponse, UserUpdate
from app.modules.users.service import UserAdministrationService

router = APIRouter(prefix="/users", tags=["Users"], route_class=BusinessRoute)
POLICY = {"allOf": ["users.manage"]}
Manager = Annotated[Principal, Depends(require_permissions(all_of=("users.manage",)))]
Service = Annotated[UserAdministrationService, Depends(get_user_service)]
UserSort = Literal[
    "id", "-id", "fullName", "-fullName", "email", "-email", "createdAt", "-createdAt"
]
UserStatus = Literal["ACTIVE", "LOCKED"]


@router.get(
    "",
    operation_id="listUsers",
    response_model=UserListResponse,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": POLICY},
)
def list_users(
    principal: Manager,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    groupId: CatalogParameter | None = None,
    status: UserStatus | None = None,
    sort: UserSort = "id",
) -> UserListResponse:
    return service.list(limit=limit, cursor=cursor, q=q, groupId=groupId, status=status, sort=sort)


@router.get(
    "/{userId}",
    operation_id="getUser",
    response_model=UserResponse,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": POLICY},
)
def get_user(userId: Id, principal: Manager, service: Service, response: Response) -> UserResponse:
    item = service.get(int(userId))
    response.headers["ETag"] = service.etag(item)
    return item


@router.post(
    "",
    operation_id="createUser",
    status_code=201,
    response_model=UserResponse,
    responses=responses(201, 400, 401, 403, 404, 409, 415, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": POLICY},
)
def create_user(
    body: UserCreate, principal: Manager, service: Service, response: Response
) -> UserResponse:
    item = service.create(body)
    response.headers["ETag"] = service.etag(item)
    response.headers["Location"] = f"/api/v1/users/{item.id}"
    return item


@router.patch(
    "/{userId}",
    operation_id="updateUser",
    response_model=UserResponse,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": POLICY},
)
def update_user(
    userId: Id,
    body: UserUpdate,
    principal: Manager,
    service: Service,
    request: Request,
    response: Response,
    match: MatchHeader,
) -> UserResponse:
    item = service.update(int(userId), body, read_preconditions(request))
    response.headers["ETag"] = service.etag(item)
    return item


@router.post(
    "/{userId}/password-reset",
    operation_id="resetUserPassword",
    status_code=204,
    responses=responses(204, 400, 401, 403, 404, 412, 415, 422, 428, 429, 500),
    openapi_extra={"x-permissions": POLICY},
)
def reset_user_password(
    userId: Id,
    body: AdminPasswordReset,
    principal: Manager,
    service: Service,
    request: Request,
    match: MatchHeader,
) -> Response:
    service.reset_password(int(userId), body, read_preconditions(request))
    return Response(status_code=204)
