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
    PaymentMethod,
    PaymentReceipt,
    ReceiptType,
)
from app.modules.document_corrections.manual_receipts import ManualReceiptCorrectionService
from app.modules.payment_receipts.dependencies import get_payment_receipt_service
from app.modules.payment_receipts.schemas import (
    PaymentReceiptCorrection,
    PaymentReceiptCreate,
    PaymentReceiptUpdate,
)
from app.modules.payment_receipts.service import PaymentReceiptService
from app.modules.stock_receipts.schemas import Reason

router = APIRouter(prefix="/payment-receipts", tags=["Payment Receipts"], route_class=BusinessRoute)
READ = {"anyOf": ["cash.receipt.prepare", "cash.receipt.post", "debt.read"]}
PREPARE = {"allOf": ["cash.receipt.prepare"]}
POST = {"allOf": ["cash.receipt.post"]}
Reader = Annotated[Principal, Depends(require_permissions(any_of=tuple(READ["anyOf"])))]
Preparer = Annotated[Principal, Depends(require_permissions(all_of=("cash.receipt.prepare",)))]
Poster = Annotated[Principal, Depends(require_permissions(all_of=("cash.receipt.post",)))]
Service = Annotated[PaymentReceiptService, Depends(get_payment_receipt_service)]
Key = Annotated[UUID, Header(alias="Idempotency-Key")]

Corrector = Annotated[
    Principal, Depends(require_permissions(all_of=("documents.correct", "cash.receipt.post")))
]
Canceller = Annotated[Principal, Depends(require_permissions(all_of=("documents.cancel",)))]


@router.post(
    "/{documentId}/corrections",
    operation_id="correctPaymentReceipt",
    response_model=MutationResult,
    status_code=201,
    responses=responses(201, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": {"allOf": ["documents.correct", "cash.receipt.post"]}},
)
def correct_payment_receipt(
    documentId: Id,
    body: PaymentReceiptCorrection,
    principal: Corrector,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = ManualReceiptCorrectionService(service).correct(
        int(documentId), body, read_preconditions(request), key
    )
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.post(
    "/{documentId}/cancel",
    operation_id="cancelPaymentReceipt",
    response_model=MutationResult,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": {"allOf": ["documents.cancel"]}},
)
def cancel_payment_receipt(
    documentId: Id,
    body: Reason,
    principal: Canceller,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = ManualReceiptCorrectionService(service).cancel(
        int(documentId), body, read_preconditions(request), key
    )
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.get(
    "",
    operation_id="listPaymentReceipts",
    response_model=DocumentList,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_payment_receipts(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    code: NonEmptyText | None = None,
    status: DocumentStatus | None = None,
    agencyId: Id | None = None,
    originDocumentId: Id | None = None,
    receiptType: ReceiptType | None = None,
    paymentMethod: PaymentMethod | None = None,
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
        receiptType=receiptType,
        paymentMethod=paymentMethod,
        fromDate=fromDate,
        toDate=toDate,
        sort=sort,
    )


@router.get(
    "/{documentId}",
    operation_id="getPaymentReceipt",
    response_model=PaymentReceipt,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ},
)
def get_payment_receipt(documentId: Id, principal: Reader, service: Service, response: Response):
    item = service.get(int(documentId))
    response.headers["ETag"] = service.etag(item)
    return item


@router.post(
    "",
    operation_id="createPaymentReceipt",
    response_model=MutationResult,
    status_code=201,
    responses=responses(201, 400, 401, 403, 404, 409, 415, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": PREPARE},
)
def create_payment_receipt(
    body: PaymentReceiptCreate, principal: Preparer, service: Service, key: Key
):
    result = service.create(body, key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.patch(
    "/{documentId}",
    operation_id="updatePaymentReceiptDraft",
    response_model=PaymentReceipt,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": PREPARE},
)
def update_payment_receipt(
    documentId: Id,
    body: PaymentReceiptUpdate,
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
    operation_id="postPaymentReceipt",
    response_model=MutationResult,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": POST},
)
def post_payment_receipt(
    documentId: Id,
    principal: Poster,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = service.post(int(documentId), read_preconditions(request), key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)
