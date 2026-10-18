from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.common.catalogue_http import CatalogSort, MasterStatus, MatchHeader, responses
from app.common.preconditions import read_preconditions
from app.common.schemas import CatalogParameter, Cursor, Limit, NonEmptyText
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.districts.dependencies import get_district_service
from app.modules.districts.schemas import (
    DistrictCreate,
    DistrictListResponse,
    DistrictResponse,
    DistrictUpdate,
)
from app.modules.districts.service import DistrictService

router = APIRouter(prefix="/districts", tags=["Districts"], route_class=BusinessRoute)
READ = {"anyOf": ["district.manage", "agency.read", "agency.manage"]}
WRITE = {"allOf": ["district.manage"]}
Reader = Annotated[Principal, Depends(require_permissions(any_of=tuple(READ["anyOf"])))]
Writer = Annotated[Principal, Depends(require_permissions(all_of=tuple(WRITE["allOf"])))]
Service = Annotated[DistrictService, Depends(get_district_service)]


@router.get(
    "",
    operation_id="listDistricts",
    response_model=DistrictListResponse,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_districts(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    code: NonEmptyText | None = None,
    status: MasterStatus | None = None,
    sort: CatalogSort = "id",
) -> DistrictListResponse:
    return service.list(limit=limit, cursor=cursor, q=q, code=code, status=status, sort=sort)


@router.get(
    "/{districtId}",
    operation_id="getDistrict",
    response_model=DistrictResponse,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ},
)
def get_district(
    districtId: CatalogParameter, principal: Reader, service: Service, response: Response
) -> DistrictResponse:
    item = service.get(districtId)
    response.headers["ETag"] = service.etag(item)
    return item


@router.post(
    "",
    operation_id="createDistrict",
    status_code=201,
    response_model=DistrictResponse,
    responses=responses(201, 400, 401, 403, 409, 415, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def create_district(
    body: DistrictCreate, principal: Writer, service: Service, response: Response
) -> DistrictResponse:
    item = service.create(body)
    response.headers["ETag"] = service.etag(item)
    response.headers["Location"] = f"/api/v1/districts/{item.id}"
    return item


@router.patch(
    "/{districtId}",
    operation_id="updateDistrict",
    response_model=DistrictResponse,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def update_district(
    districtId: CatalogParameter,
    body: DistrictUpdate,
    principal: Writer,
    service: Service,
    request: Request,
    response: Response,
    match: MatchHeader,
) -> DistrictResponse:
    item = service.update(districtId, body, read_preconditions(request))
    response.headers["ETag"] = service.etag(item)
    return item


@router.delete(
    "/{districtId}",
    operation_id="deleteDistrict",
    status_code=204,
    responses=responses(204, 401, 403, 404, 409, 412, 422, 428, 429, 500),
    openapi_extra={"x-permissions": WRITE},
)
def delete_district(
    districtId: CatalogParameter,
    principal: Writer,
    service: Service,
    request: Request,
    match: MatchHeader,
) -> Response:
    service.delete(districtId, read_preconditions(request))
    return Response(status_code=204)
