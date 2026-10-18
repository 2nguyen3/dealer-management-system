from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.common.catalogue_http import CatalogSort, MasterStatus, MatchHeader, responses
from app.common.preconditions import read_preconditions
from app.common.schemas import CatalogParameter, Cursor, Limit, NonEmptyText
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.units.dependencies import get_unit_service
from app.modules.units.schemas import UnitCreate, UnitListResponse, UnitResponse, UnitUpdate
from app.modules.units.service import UnitService

router = APIRouter(prefix="/units", tags=["Units"], route_class=BusinessRoute)
READ = {"anyOf": ["unit.manage", "product.manage", "inventory.read"]}
WRITE = {"allOf": ["unit.manage"]}
Reader = Annotated[Principal, Depends(require_permissions(any_of=tuple(READ["anyOf"])))]
Writer = Annotated[Principal, Depends(require_permissions(all_of=tuple(WRITE["allOf"])))]
Service = Annotated[UnitService, Depends(get_unit_service)]


@router.get(
    "",
    operation_id="listUnits",
    response_model=UnitListResponse,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_units(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    code: NonEmptyText | None = None,
    status: MasterStatus | None = None,
    allowsFraction: bool | None = None,
    sort: CatalogSort = "id",
) -> UnitListResponse:
    return service.list(
        limit=limit,
        cursor=cursor,
        q=q,
        code=code,
        status=status,
        allowsFraction=allowsFraction,
        sort=sort,
    )


@router.get(
    "/{unitId}",
    operation_id="getUnit",
    response_model=UnitResponse,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ},
)
def get_unit(
    unitId: CatalogParameter, principal: Reader, service: Service, response: Response
) -> UnitResponse:
    item = service.get(unitId)
    response.headers["ETag"] = service.etag(item)
    return item


@router.post(
    "",
    operation_id="createUnit",
    status_code=201,
    response_model=UnitResponse,
    responses=responses(201, 400, 401, 403, 409, 415, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def create_unit(
    body: UnitCreate, principal: Writer, service: Service, response: Response
) -> UnitResponse:
    item = service.create(body)
    response.headers["ETag"] = service.etag(item)
    response.headers["Location"] = f"/api/v1/units/{item.id}"
    return item


@router.patch(
    "/{unitId}",
    operation_id="updateUnit",
    response_model=UnitResponse,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def update_unit(
    unitId: CatalogParameter,
    body: UnitUpdate,
    principal: Writer,
    service: Service,
    request: Request,
    response: Response,
    match: MatchHeader,
) -> UnitResponse:
    item = service.update(unitId, body, read_preconditions(request))
    response.headers["ETag"] = service.etag(item)
    return item


@router.delete(
    "/{unitId}",
    operation_id="deleteUnit",
    status_code=204,
    responses=responses(204, 401, 403, 404, 409, 412, 422, 428, 429, 500),
    openapi_extra={"x-permissions": WRITE},
)
def delete_unit(
    unitId: CatalogParameter,
    principal: Writer,
    service: Service,
    request: Request,
    match: MatchHeader,
) -> Response:
    service.delete(unitId, read_preconditions(request))
    return Response(status_code=204)
