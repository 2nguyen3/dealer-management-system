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
    SalesReturn,
)
from app.modules.sales_returns.dependencies import get_sales_return_service
from app.modules.sales_returns.schemas import SalesReturnCreate
from app.modules.sales_returns.service import SalesReturnService
from app.modules.stock_receipts.schemas import StockHeaderUpdate

router = APIRouter(prefix="/sales-returns", tags=["Sales Returns"], route_class=BusinessRoute)
READ = {"anyOf": ["returns.prepare", "returns.post", "debt.read", "sales.read"]}
PREPARE = {"allOf": ["returns.prepare"]}
POST = {"allOf": ["returns.post"]}
Reader = Annotated[Principal, Depends(require_permissions(any_of=tuple(READ["anyOf"])))]
Preparer = Annotated[Principal, Depends(require_permissions(all_of=("returns.prepare",)))]
Poster = Annotated[Principal, Depends(require_permissions(all_of=("returns.post",)))]
Service = Annotated[SalesReturnService, Depends(get_sales_return_service)]
Key = Annotated[UUID, Header(alias="Idempotency-Key")]


@router.get(
    "",
    operation_id="listSalesReturns",
    response_model=DocumentList,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_sales_returns(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    code: NonEmptyText | None = None,
    status: DocumentStatus | None = None,
    agencyId: Id | None = None,
    originDocumentId: Id | None = None,
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
        agencyId=agencyId,
        originDocumentId=originDocumentId,
        productId=productId,
        fromDate=fromDate,
        toDate=toDate,
        sort=sort,
    )


@router.get(
    "/{documentId}",
    operation_id="getSalesReturn",
    response_model=SalesReturn,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ},
)
def get_sales_return(documentId: Id, principal: Reader, service: Service, response: Response):
    item = service.get(int(documentId))
    response.headers["ETag"] = service.etag(item)
    return item


@router.post(
    "",
    operation_id="createSalesReturn",
    response_model=MutationResult,
    status_code=201,
    responses=responses(201, 400, 401, 403, 404, 409, 415, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": PREPARE},
)
def create_sales_return(body: SalesReturnCreate, principal: Preparer, service: Service, key: Key):
    result = service.create(body, key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.patch(
    "/{documentId}",
    operation_id="updateSalesReturnDraft",
    response_model=SalesReturn,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": PREPARE},
)
def update_sales_return(
    documentId: Id,
    body: StockHeaderUpdate,
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
    operation_id="postSalesReturn",
    response_model=MutationResult,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": POST},
)
def post_sales_return(
    documentId: Id,
    principal: Poster,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = service.post(int(documentId), read_preconditions(request), key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)
