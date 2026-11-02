from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Response
from fastapi.responses import JSONResponse

from app.common.catalogue_http import MatchHeader, responses
from app.common.preconditions import read_preconditions
from app.common.schemas import (
    BusinessDate,
    CatalogParameter,
    Cursor,
    Id,
    Limit,
    Money,
    NonEmptyText,
)
from app.common.transport import BusinessRoute
from app.modules.agencies.dependencies import get_agency_service
from app.modules.agencies.schemas import (
    AgencyCreate,
    AgencyListResponse,
    AgencyResponse,
    AgencyUpdate,
    Reason,
)
from app.modules.agencies.service import AgencyService
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal

router = APIRouter(prefix="/agencies", tags=["Agencies"], route_class=BusinessRoute)
READ = {"anyOf": ["agency.read", "agency.manage"]}
WRITE = {"allOf": ["agency.manage"]}
Reader = Annotated[Principal, Depends(require_permissions(any_of=tuple(READ["anyOf"])))]
Writer = Annotated[Principal, Depends(require_permissions(all_of=("agency.manage",)))]
Service = Annotated[AgencyService, Depends(get_agency_service)]


@router.get(
    "",
    operation_id="listAgencies",
    response_model=AgencyListResponse,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_agencies(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    code: NonEmptyText | None = None,
    typeId: CatalogParameter | None = None,
    districtId: CatalogParameter | None = None,
    phone: NonEmptyText | None = None,
    status: Literal["ACTIVE", "TERMINATED"] | None = None,
    debtFrom: Money | None = None,
    debtTo: Money | None = None,
    acceptedFrom: BusinessDate | None = None,
    acceptedTo: BusinessDate | None = None,
    sort: Literal[
        "id", "-id", "name", "-name", "currentDebt", "-currentDebt", "acceptedDate", "-acceptedDate"
    ] = "id",
):
    return service.list(
        limit=limit,
        cursor=cursor,
        q=q,
        code=code,
        typeId=typeId,
        districtId=districtId,
        phone=phone,
        status=status,
        debtFrom=debtFrom,
        debtTo=debtTo,
        acceptedFrom=acceptedFrom,
        acceptedTo=acceptedTo,
        sort=sort,
    )


@router.get(
    "/{agencyId}",
    operation_id="getAgency",
    response_model=AgencyResponse,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ},
)
def get_agency(agencyId: Id, principal: Reader, service: Service, response: Response):
    item = service.get(int(agencyId))
    response.headers["ETag"] = service.etag(item)
    return item


@router.post(
    "",
    operation_id="createAgency",
    response_model=AgencyResponse,
    status_code=201,
    responses=responses(201, 400, 401, 403, 404, 409, 415, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def create_agency(body: AgencyCreate, principal: Writer, service: Service, response: Response):
    item = service.create(body)
    response.headers["ETag"] = service.etag(item)
    response.headers["Location"] = "/api/v1/agencies/" + item.id
    return item


@router.patch(
    "/{agencyId}",
    operation_id="updateAgency",
    response_model=AgencyResponse,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def update_agency(
    agencyId: Id,
    body: AgencyUpdate,
    principal: Writer,
    service: Service,
    request: Request,
    response: Response,
    match: MatchHeader,
):
    item = service.update(int(agencyId), body, read_preconditions(request))
    response.headers["ETag"] = service.etag(item)
    return item


@router.delete(
    "/{agencyId}",
    operation_id="deleteAgency",
    status_code=204,
    responses=responses(204, 401, 403, 404, 409, 412, 422, 428, 429, 500),
    openapi_extra={"x-permissions": WRITE},
)
def delete_agency(
    agencyId: Id, principal: Writer, service: Service, request: Request, match: MatchHeader
):
    service.delete(int(agencyId), read_preconditions(request))
    return Response(status_code=204)


@router.post(
    "/{agencyId}/terminate",
    operation_id="terminateAgency",
    response_model=AgencyResponse,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def terminate_agency(
    agencyId: Id,
    body: Reason,
    principal: Writer,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Annotated[UUID, Header(alias="Idempotency-Key")],
):
    result = service.terminate(int(agencyId), body, read_preconditions(request), key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)
