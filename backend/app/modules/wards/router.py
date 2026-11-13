from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.common.catalogue_http import CatalogSort, responses
from app.common.schemas import CatalogParameter, Cursor, Limit, NonEmptyText
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.wards.dependencies import get_ward_service
from app.modules.wards.schemas import WardKind, WardListResponse, WardResponse
from app.modules.wards.service import WardService

router = APIRouter(prefix="/wards", tags=["Wards"], route_class=BusinessRoute)
READ = {"anyOf": ["agency.read", "agency.manage"]}
Reader = Annotated[Principal, Depends(require_permissions(any_of=tuple(READ["anyOf"])))]
Service = Annotated[WardService, Depends(get_ward_service)]


@router.get(
    "",
    operation_id="listWards",
    response_model=WardListResponse,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_wards(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    code: NonEmptyText | None = None,
    kind: WardKind | None = None,
    sort: CatalogSort = "id",
) -> WardListResponse:
    return service.list(limit=limit, cursor=cursor, q=q, code=code, kind=kind, sort=sort)


@router.get(
    "/{wardId}",
    operation_id="getWard",
    response_model=WardResponse,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ},
)
def get_ward(
    wardId: CatalogParameter, principal: Reader, service: Service, response: Response
) -> WardResponse:
    item = service.get(wardId)
    response.headers["ETag"] = service.etag(item)
    return item
