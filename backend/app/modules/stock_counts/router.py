from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Response
from fastapi.responses import JSONResponse

from app.common.catalogue_http import MatchHeader, responses
from app.common.preconditions import read_preconditions
from app.common.schemas import Cursor, Id, Instant, Limit, NonEmptyText
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.stock_counts.dependencies import get_stock_count_service
from app.modules.stock_counts.schemas import (
    CountLineInput,
    CountLineList,
    CountLineUpdate,
    StockCount,
    StockCountCreate,
    StockCountLine,
    StockCountList,
    StockCountUpdate,
    StockRecount,
)
from app.modules.stock_counts.service import StockCountService

router = APIRouter(prefix="/stock-counts", tags=["Stock Counts"], route_class=BusinessRoute)
POLICY = {"allOf": ["stock.count"]}
User = Annotated[Principal, Depends(require_permissions(all_of=("stock.count",)))]
Service = Annotated[StockCountService, Depends(get_stock_count_service)]
Key = Annotated[UUID, Header(alias="Idempotency-Key")]


@router.get(
    "",
    operation_id="listStockCounts",
    response_model=StockCountList,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": POLICY},
)
def list_stock_counts(
    principal: User,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    code: NonEmptyText | None = None,
    state: Literal["DRAFT", "CONFIRMED"] | None = None,
    productId: Id | None = None,
    countedFrom: Instant | None = None,
    countedTo: Instant | None = None,
    sort: Literal["id", "-id", "countedAt", "-countedAt"] = "-countedAt",
):
    return service.list(
        limit=limit,
        cursor=cursor,
        code=code,
        state=state,
        productId=productId,
        countedFrom=countedFrom,
        countedTo=countedTo,
        sort=sort,
    )


@router.post(
    "",
    operation_id="createStockCount",
    response_model=StockCount,
    status_code=201,
    responses=responses(201, 400, 401, 403, 404, 409, 415, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": POLICY},
)
def create_stock_count(body: StockCountCreate, principal: User, service: Service, key: Key):
    result = service.create(body, key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.get(
    "/{countId}",
    operation_id="getStockCount",
    response_model=StockCount,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": POLICY},
)
def get_stock_count(countId: Id, principal: User, service: Service, response: Response):
    item = service.get(int(countId))
    response.headers["ETag"] = service.etag(item)
    return item


@router.patch(
    "/{countId}",
    operation_id="updateStockCountDraft",
    response_model=StockCount,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": POLICY},
)
def update_stock_count(
    countId: Id,
    body: StockCountUpdate,
    principal: User,
    service: Service,
    request: Request,
    response: Response,
    match: MatchHeader,
):
    item = service.update(int(countId), body, read_preconditions(request))
    response.headers["ETag"] = service.etag(item)
    return item


@router.get(
    "/{countId}/lines",
    operation_id="listStockCountLines",
    response_model=CountLineList,
    responses=responses(200, 400, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": POLICY},
)
def list_stock_count_lines(
    countId: Id,
    principal: User,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    productId: Id | None = None,
    hasDifference: bool | None = None,
    sort: Literal["id", "-id"] = "id",
):
    return service.lines(
        int(countId),
        limit=limit,
        cursor=cursor,
        productId=productId,
        hasDifference=hasDifference,
        sort=sort,
    )


@router.post(
    "/{countId}/lines",
    operation_id="createStockCountLine",
    response_model=StockCountLine,
    status_code=201,
    responses=responses(201, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": POLICY},
)
def create_stock_count_line(
    countId: Id,
    body: CountLineInput,
    principal: User,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = service.create_line(int(countId), body, read_preconditions(request), key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.get(
    "/{countId}/lines/{lineId}",
    operation_id="getStockCountLine",
    response_model=StockCountLine,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": POLICY},
)
def get_stock_count_line(
    countId: Id, lineId: Id, principal: User, service: Service, response: Response
):
    item = service.get_line(int(countId), int(lineId))
    response.headers["ETag"] = service.etag(service.get(int(countId)))
    return item


@router.patch(
    "/{countId}/lines/{lineId}",
    operation_id="updateStockCountLine",
    response_model=StockCountLine,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": POLICY},
)
def update_stock_count_line(
    countId: Id,
    lineId: Id,
    body: CountLineUpdate,
    principal: User,
    service: Service,
    request: Request,
    response: Response,
    match: MatchHeader,
):
    result = service.update_line(int(countId), int(lineId), body, read_preconditions(request))
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.post(
    "/{countId}/recount",
    operation_id="recountStock",
    response_model=StockCount,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": POLICY},
)
def recount_stock(
    countId: Id,
    body: StockRecount,
    principal: User,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = service.recount(int(countId), body, read_preconditions(request), key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.post(
    "/{countId}/confirm",
    operation_id="confirmStockCount",
    response_model=StockCount,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 422, 428, 429, 500, etag=True),
    openapi_extra={
        "x-permissions": {**POLICY, "conditional": "stock.adjustment.post khi có chênh lệch"}
    },
)
def confirm_stock_count(
    countId: Id, principal: User, service: Service, request: Request, match: MatchHeader, key: Key
):
    result = service.confirm(int(countId), read_preconditions(request), key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)
