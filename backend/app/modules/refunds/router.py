from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Response
from fastapi.responses import JSONResponse

from app.common.catalogue_http import MatchHeader, responses
from app.common.preconditions import canonical_etag, read_preconditions
from app.common.schemas import BusinessDate, Cursor, Id, Limit, NonEmptyText
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.document_core.schemas import DocumentList, DocumentStatus, MutationResult, Refund
from app.modules.refunds.dependencies import get_refund_service
from app.modules.refunds.online import OnlineRefundService
from app.modules.refunds.reads import RefundEvidenceReads
from app.modules.refunds.schemas import (
    ManualRefundConfirmation,
    RefundAttempt,
    RefundAttemptList,
    RefundCreate,
    RefundReservationList,
    RefundUpdate,
)
from app.modules.stock_receipts.schemas import Reason


def refund_responses(*statuses, **kwargs):
    result = responses(*statuses, **kwargs)
    if 503 in result:
        result[503]["headers"]["Retry-After"] = {"schema": {"type": "integer", "minimum": 1}}
    if 202 in result:
        result[202]["headers"].update(
            {
                "Location": {"schema": {"type": "string", "format": "uri-reference"}},
                "Retry-After": {"schema": {"type": "integer", "minimum": 1}},
            }
        )
    return result


router = APIRouter(tags=["Refunds"], route_class=BusinessRoute)
READ = {"anyOf": ["cash.refund.prepare", "cash.refund.post", "debt.read"]}
PREPARE = {"allOf": ["cash.refund.prepare"]}
POST = {"allOf": ["cash.refund.post"]}
CANCEL = {"allOf": ["documents.cancel", "cash.refund.post"]}
EVIDENCE = {"anyOf": ["cash.refund.post", "debt.read"]}
Reader = Annotated[Principal, Depends(require_permissions(any_of=tuple(READ["anyOf"])))]
Preparer = Annotated[Principal, Depends(require_permissions(all_of=tuple(PREPARE["allOf"])))]
Poster = Annotated[Principal, Depends(require_permissions(all_of=tuple(POST["allOf"])))]
Canceller = Annotated[Principal, Depends(require_permissions(all_of=tuple(CANCEL["allOf"])))]
EvidenceReader = Annotated[Principal, Depends(require_permissions(any_of=tuple(EVIDENCE["anyOf"])))]
Service = Annotated[OnlineRefundService, Depends(get_refund_service)]
Key = Annotated[UUID, Header(alias="Idempotency-Key")]
AttemptState = Literal["PENDING", "UNKNOWN", "SUCCESS", "FAILED"]
TimeSort = Literal["id", "-id", "createdAt", "-createdAt"]


def emit(result):
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.get(
    "/refunds",
    operation_id="listRefunds",
    response_model=DocumentList,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_refunds(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    code: NonEmptyText | None = None,
    status: DocumentStatus | None = None,
    agencyId: Id | None = None,
    originDocumentId: Id | None = None,
    attemptState: AttemptState | None = None,
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
        attemptState=attemptState,
        fromDate=fromDate,
        toDate=toDate,
        sort=sort,
    )


@router.get(
    "/refunds/{documentId}",
    operation_id="getRefund",
    response_model=Refund,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ},
)
def get_refund(documentId: Id, principal: Reader, service: Service, response: Response):
    item = service.get(int(documentId))
    response.headers["ETag"] = service.etag(item)
    return item


@router.post(
    "/refunds",
    operation_id="createRefund",
    response_model=MutationResult,
    status_code=201,
    responses=responses(201, 400, 401, 403, 404, 409, 415, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": PREPARE},
)
def create_refund(body: RefundCreate, principal: Preparer, service: Service, key: Key):
    return emit(service.create(body, key))


@router.patch(
    "/refunds/{documentId}",
    operation_id="updateRefundDraft",
    response_model=Refund,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": PREPARE},
)
def update_refund(
    documentId: Id,
    body: RefundUpdate,
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
    "/refunds/{documentId}/submit",
    operation_id="submitRefund",
    response_model=MutationResult,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": POST},
)
def submit_refund(
    documentId: Id,
    principal: Poster,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    return emit(service.submit(int(documentId), read_preconditions(request), key))


@router.post(
    "/refunds/{documentId}/confirm-paid",
    operation_id="confirmManualRefundPaid",
    response_model=MutationResult,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": POST},
)
def confirm_refund(
    documentId: Id,
    body: ManualRefundConfirmation,
    principal: Poster,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    return emit(service.confirm_paid(int(documentId), body, read_preconditions(request), key))


@router.post(
    "/refunds/{documentId}/cancel",
    operation_id="cancelUnpaidRefund",
    response_model=MutationResult,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": CANCEL},
)
def cancel_refund(
    documentId: Id,
    body: Reason,
    principal: Canceller,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    return emit(service.cancel(int(documentId), body, read_preconditions(request), key))


@router.get(
    "/refunds/{documentId}/attempts",
    operation_id="listRefundAttempts",
    response_model=RefundAttemptList,
    responses=responses(200, 400, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": EVIDENCE},
)
def list_refund_attempts(
    documentId: Id,
    principal: EvidenceReader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    state: AttemptState | None = None,
    sort: TimeSort = "-createdAt",
):
    return RefundEvidenceReads(service).page(
        int(documentId), resource="attempts", limit=limit, cursor=cursor, state=state, sort=sort
    )


@router.post(
    "/refunds/{documentId}/attempts",
    operation_id="requestOnlineRefund",
    response_model=RefundAttempt,
    status_code=202,
    responses=refund_responses(202, 400, 401, 403, 404, 409, 412, 422, 428, 429, 500, 503),
    openapi_extra={"x-permissions": POST},
)
def request_refund(
    documentId: Id,
    principal: Poster,
    service: Service,
    request: Request,
    response: Response,
    match: MatchHeader,
    key: Key,
):
    item = service.request(int(documentId), read_preconditions(request), key)
    response.headers["Location"] = f"/api/v1/refund-attempts/{item.id}"
    response.headers["Retry-After"] = "5"
    response.headers["ETag"] = service.etag(service.get(int(documentId)))
    return item


@router.get(
    "/refund-attempts/{attemptId}",
    operation_id="getRefundAttempt",
    response_model=RefundAttempt,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": EVIDENCE},
)
def get_refund_attempt(
    attemptId: Id, principal: EvidenceReader, service: Service, response: Response
):
    item = RefundEvidenceReads(service).attempt(int(attemptId))
    response.headers["ETag"] = canonical_etag(
        f"refund-attempt:{item.id}", item.model_dump(mode="json")
    )
    return item


@router.post(
    "/refund-attempts/{attemptId}/reconcile",
    operation_id="reconcileRefundAttempt",
    response_model=RefundAttempt,
    responses=refund_responses(200, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503, etag=True),
    openapi_extra={"x-permissions": POST},
)
def reconcile_refund(
    attemptId: Id, principal: Poster, service: Service, key: Key, response: Response
):
    item = service.reconcile(int(attemptId), key)
    response.headers["ETag"] = canonical_etag(
        f"refund-attempt:{item.id}", item.model_dump(mode="json")
    )
    return item


@router.get(
    "/refunds/{documentId}/reservations",
    operation_id="listRefundReservations",
    response_model=RefundReservationList,
    responses=responses(200, 400, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": EVIDENCE},
)
def list_refund_reservations(
    documentId: Id,
    principal: EvidenceReader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    state: Literal["ACTIVE", "RELEASED", "CONSUMED"] | None = None,
    sort: Literal["id", "-id"] = "id",
):
    return RefundEvidenceReads(service).page(
        int(documentId), resource="reservations", limit=limit, cursor=cursor, state=state, sort=sort
    )
