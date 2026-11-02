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
    StockIssue,
)
from app.modules.document_corrections.issues import IssueCorrectionService
from app.modules.stock_issues.dependencies import get_stock_issue_service
from app.modules.stock_issues.schemas import (
    PendingIssueRevision,
    StockIssueCorrection,
    StockIssueCreate,
    StockIssueUpdate,
)
from app.modules.stock_issues.service import StockIssueService
from app.modules.stock_receipts.schemas import Reason

router = APIRouter(prefix="/stock-issues", tags=["Stock Issues"], route_class=BusinessRoute)
correction_router = APIRouter(
    prefix="/stock-issues", tags=["Stock Issues"], route_class=BusinessRoute
)
READ = {"anyOf": ["stock.issue.prepare", "stock.issue.post", "debt.read", "sales.read"]}
PREPARE = {"allOf": ["stock.issue.prepare"]}
POST = {"allOf": ["stock.issue.post"]}
Reader = Annotated[Principal, Depends(require_permissions(any_of=tuple(READ["anyOf"])))]
Preparer = Annotated[Principal, Depends(require_permissions(all_of=("stock.issue.prepare",)))]
Poster = Annotated[Principal, Depends(require_permissions(all_of=("stock.issue.post",)))]
Service = Annotated[StockIssueService, Depends(get_stock_issue_service)]
Key = Annotated[UUID, Header(alias="Idempotency-Key")]

Corrector = Annotated[
    Principal, Depends(require_permissions(all_of=("documents.correct", "stock.issue.post")))
]
Canceller = Annotated[Principal, Depends(require_permissions(all_of=("documents.cancel",)))]


@correction_router.post(
    "/{documentId}/corrections",
    operation_id="correctStockIssue",
    response_model=MutationResult,
    status_code=201,
    responses=responses(201, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": {"allOf": ["documents.correct", "stock.issue.post"]}},
)
def correct_stock_issue(
    documentId: Id,
    body: StockIssueCorrection,
    principal: Corrector,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = IssueCorrectionService(service).correct(
        int(documentId), body, read_preconditions(request), key
    )
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@correction_router.post(
    "/{documentId}/cancel",
    operation_id="cancelStockIssue",
    response_model=MutationResult,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={
        "x-permissions": {
            "allOf": ["documents.cancel"],
            "conditional": (
                "cash.receipt.post nếu có bằng chứng trả ngay cần chuyển thành phiếu thu riêng"
            ),
        }
    },
)
def cancel_stock_issue(
    documentId: Id,
    body: Reason,
    principal: Canceller,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = IssueCorrectionService(service).cancel(
        int(documentId), body, read_preconditions(request), key
    )
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.get(
    "",
    operation_id="listStockIssues",
    response_model=DocumentList,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_stock_issues(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    code: NonEmptyText | None = None,
    status: DocumentStatus | None = None,
    agencyId: Id | None = None,
    productId: Id | None = None,
    settlementStatus: Literal["UNSETTLED", "PARTIAL", "SETTLED"] | None = None,
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
        productId=productId,
        settlementStatus=settlementStatus,
        fromDate=fromDate,
        toDate=toDate,
        sort=sort,
    )


@router.get(
    "/{documentId}",
    operation_id="getStockIssue",
    response_model=StockIssue,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ},
)
def get_stock_issue(documentId: Id, principal: Reader, service: Service, response: Response):
    item = service.get(int(documentId))
    response.headers["ETag"] = service.etag(item)
    return item


@router.post(
    "",
    operation_id="createStockIssue",
    response_model=MutationResult,
    status_code=201,
    responses=responses(201, 400, 401, 403, 404, 409, 415, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": PREPARE},
)
def create_stock_issue(body: StockIssueCreate, principal: Preparer, service: Service, key: Key):
    result = service.create(body, key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.patch(
    "/{documentId}",
    operation_id="updateStockIssueDraft",
    response_model=StockIssue,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": PREPARE},
)
def update_stock_issue(
    documentId: Id,
    body: StockIssueUpdate,
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
    "/{documentId}/submit",
    operation_id="submitStockIssue",
    response_model=MutationResult,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": PREPARE},
)
def submit_stock_issue(
    documentId: Id,
    principal: Preparer,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = service.submit(int(documentId), read_preconditions(request), key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.post(
    "/{documentId}/post",
    operation_id="postStockIssue",
    response_model=MutationResult,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": POST},
)
def post_stock_issue(
    documentId: Id,
    principal: Poster,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = service.post(int(documentId), read_preconditions(request), key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.post(
    "/{documentId}/revisions",
    operation_id="replacePendingStockIssue",
    response_model=MutationResult,
    status_code=201,
    responses=responses(201, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": PREPARE},
)
def replace_pending_stock_issue(
    documentId: Id,
    body: PendingIssueRevision,
    principal: Preparer,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = service.replace_pending(int(documentId), body, read_preconditions(request), key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)
