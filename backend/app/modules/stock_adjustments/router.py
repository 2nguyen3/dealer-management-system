from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Response
from fastapi.responses import JSONResponse

from app.common.catalogue_http import MatchHeader, responses
from app.common.preconditions import read_preconditions
from app.common.schemas import BusinessDate, Cursor, Id, Limit, NonEmptyText
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.document_core.schemas import (
    DocumentList,
    DocumentStatus,
    MutationResult,
    StockAdjustment,
)
from app.modules.stock_adjustments.dependencies import get_stock_adjustment_service
from app.modules.stock_adjustments.schemas import StockAdjustmentCreate, StockAdjustmentUpdate
from app.modules.stock_adjustments.service import StockAdjustmentService

router = APIRouter(
    prefix="/stock-adjustments", tags=["Stock Adjustments"], route_class=BusinessRoute
)
READ = {"anyOf": ["stock.adjustment.prepare", "stock.adjustment.post", "inventory.read"]}
PREPARE = {"allOf": ["stock.adjustment.prepare"]}
POST = {"allOf": ["stock.adjustment.post"]}
Reader = Annotated[Principal, Depends(require_permissions(any_of=tuple(READ["anyOf"])))]
Preparer = Annotated[Principal, Depends(require_permissions(all_of=("stock.adjustment.prepare",)))]
Poster = Annotated[Principal, Depends(require_permissions(all_of=("stock.adjustment.post",)))]
Service = Annotated[StockAdjustmentService, Depends(get_stock_adjustment_service)]
Key = Annotated[UUID, Header(alias="Idempotency-Key")]


@router.get(
    "",
    operation_id="listStockAdjustments",
    response_model=DocumentList,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_stock_adjustments(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    code: NonEmptyText | None = None,
    status: DocumentStatus | None = None,
    productId: Id | None = None,
    fromDate: BusinessDate | None = None,
    toDate: BusinessDate | None = None,
    sort: Literal[
        "id",
        "-id",
        "businessDate",
        "-businessDate",
        "totalAmount",
        "-totalAmount",
        "createdAt",
        "-createdAt",
    ] = "-businessDate",
):
    return service.list(
        limit=limit,
        cursor=cursor,
        q=q,
        code=code,
        status=status,
        productId=productId,
        fromDate=fromDate,
        toDate=toDate,
        sort=sort,
    )


@router.get(
    "/{documentId}",
    operation_id="getStockAdjustment",
    response_model=StockAdjustment,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ},
)
def get_stock_adjustment(documentId: Id, principal: Reader, service: Service, response: Response):
    item = service.get(int(documentId))
    response.headers["ETag"] = service.etag(item)
    return item


@router.post(
    "",
    operation_id="createStockAdjustment",
    response_model=MutationResult,
    status_code=201,
    responses=responses(201, 400, 401, 403, 404, 409, 415, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": PREPARE},
)
def create_stock_adjustment(
    body: StockAdjustmentCreate, principal: Preparer, service: Service, key: Key
):
    result = service.create(body, key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.patch(
    "/{documentId}",
    operation_id="updateStockAdjustmentDraft",
    response_model=StockAdjustment,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": PREPARE},
)
def update_stock_adjustment_draft(
    documentId: Id,
    body: StockAdjustmentUpdate,
    principal: Preparer,
    service: Service,
    request: Request,
    response: Response,
    match: MatchHeader,
):
    item = service.update(int(documentId), body, read_preconditions(request))
    response.headers["ETag"] = service.etag(item)
    return item


@router.post(
    "/{documentId}/post",
    operation_id="postStockAdjustment",
    response_model=MutationResult,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": POST},
)
def post_stock_adjustment(
    documentId: Id,
    principal: Poster,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = service.post(int(documentId), read_preconditions(request), key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)
