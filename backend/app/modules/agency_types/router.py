from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request, Response

from app.common.catalogue_http import MasterStatus, MatchHeader, responses
from app.common.preconditions import read_preconditions
from app.common.schemas import CatalogParameter, Cursor, Limit, NonEmptyText
from app.common.transport import BusinessRoute
from app.modules.agency_types.dependencies import get_agency_type_service
from app.modules.agency_types.schemas import (
    AgencyTypeCreate,
    AgencyTypeListResponse,
    AgencyTypeResponse,
    AgencyTypeUpdate,
)
from app.modules.agency_types.service import AgencyTypeService
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal

router = APIRouter(prefix="/agency-types", tags=["Agency Types"], route_class=BusinessRoute)
READ = {"anyOf": ["agency_type.manage", "agency.read", "agency.manage"]}
WRITE = {"allOf": ["agency_type.manage"]}
Reader = Annotated[Principal, Depends(require_permissions(any_of=tuple(READ["anyOf"])))]
Writer = Annotated[Principal, Depends(require_permissions(all_of=tuple(WRITE["allOf"])))]
Service = Annotated[AgencyTypeService, Depends(get_agency_type_service)]
TypeSort = Literal["id", "-id", "name", "-name", "maxDebt", "-maxDebt"]


@router.get(
    "",
    operation_id="listAgencyTypes",
    response_model=AgencyTypeListResponse,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_agency_types(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    code: NonEmptyText | None = None,
    status: MasterStatus | None = None,
    sort: TypeSort = "id",
) -> AgencyTypeListResponse:
    return service.list(limit=limit, cursor=cursor, q=q, code=code, status=status, sort=sort)


@router.get(
    "/{typeId}",
    operation_id="getAgencyType",
    response_model=AgencyTypeResponse,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ},
)
def get_agency_type(
    typeId: CatalogParameter, principal: Reader, service: Service, response: Response
) -> AgencyTypeResponse:
    item = service.get(typeId)
    response.headers["ETag"] = service.etag(item)
    return item


@router.post(
    "",
    operation_id="createAgencyType",
    status_code=201,
    response_model=AgencyTypeResponse,
    responses=responses(201, 400, 401, 403, 409, 415, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def create_agency_type(
    body: AgencyTypeCreate, principal: Writer, service: Service, response: Response
) -> AgencyTypeResponse:
    item = service.create(body)
    response.headers["ETag"] = service.etag(item)
    response.headers["Location"] = f"/api/v1/agency-types/{item.id}"
    return item


@router.patch(
    "/{typeId}",
    operation_id="updateAgencyType",
    response_model=AgencyTypeResponse,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def update_agency_type(
    typeId: CatalogParameter,
    body: AgencyTypeUpdate,
    principal: Writer,
    service: Service,
    request: Request,
    response: Response,
    match: MatchHeader,
) -> AgencyTypeResponse:
    item = service.update(typeId, body, read_preconditions(request))
    response.headers["ETag"] = service.etag(item)
    return item


@router.delete(
    "/{typeId}",
    operation_id="deleteAgencyType",
    status_code=204,
    responses=responses(204, 401, 403, 404, 409, 412, 422, 428, 429, 500),
    openapi_extra={"x-permissions": WRITE},
)
def delete_agency_type(
    typeId: CatalogParameter,
    principal: Writer,
    service: Service,
    request: Request,
    match: MatchHeader,
) -> Response:
    service.delete(typeId, read_preconditions(request))
    return Response(status_code=204)
