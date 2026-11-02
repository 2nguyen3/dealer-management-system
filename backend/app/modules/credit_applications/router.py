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
from app.modules.credit_applications.dependencies import get_credit_application_service
from app.modules.credit_applications.schemas import (
    CreditApplicationCorrection,
    CreditApplicationCreate,
    CreditApplicationUpdate,
)
from app.modules.credit_applications.service import CreditApplicationService
from app.modules.document_core.schemas import (
    CreditApplication,
    DocumentList,
    DocumentStatus,
    MutationResult,
)
from app.modules.document_corrections.credit import CreditCorrectionService
from app.modules.stock_receipts.schemas import Reason

router = APIRouter(
    prefix="/credit-applications", tags=["Credit Applications"], route_class=BusinessRoute
)
correction_router = APIRouter(
    prefix="/credit-applications", tags=["Credit Applications"], route_class=BusinessRoute
)
READ = {"anyOf": ["credit.apply", "debt.read"]}
WRITE = {"allOf": ["credit.apply"]}
Reader = Annotated[Principal, Depends(require_permissions(any_of=tuple(READ["anyOf"])))]
Writer = Annotated[Principal, Depends(require_permissions(all_of=("credit.apply",)))]
Service = Annotated[CreditApplicationService, Depends(get_credit_application_service)]
Key = Annotated[UUID, Header(alias="Idempotency-Key")]

Corrector = Annotated[
    Principal, Depends(require_permissions(all_of=("documents.correct", "credit.apply")))
]
Canceller = Annotated[Principal, Depends(require_permissions(all_of=("documents.cancel",)))]


@correction_router.post(
    "/{documentId}/corrections",
    operation_id="correctCreditApplication",
    response_model=MutationResult,
    status_code=201,
    responses=responses(201, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": {"allOf": ["documents.correct", "credit.apply"]}},
)
def correct_credit_application(
    documentId: Id,
    body: CreditApplicationCorrection,
    principal: Corrector,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = CreditCorrectionService(service).correct(
        int(documentId), body, read_preconditions(request), key
    )
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@correction_router.post(
    "/{documentId}/cancel",
    operation_id="cancelCreditApplication",
    response_model=MutationResult,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": {"allOf": ["documents.cancel"]}},
)
def cancel_credit_application(
    documentId: Id,
    body: Reason,
    principal: Canceller,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = CreditCorrectionService(service).cancel(
        int(documentId), body, read_preconditions(request), key
    )
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.get(
    "",
    operation_id="listCreditApplications",
    response_model=DocumentList,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_credit_applications(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    code: NonEmptyText | None = None,
    status: DocumentStatus | None = None,
    agencyId: Id | None = None,
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
        fromDate=fromDate,
        toDate=toDate,
        sort=sort,
    )


@router.get(
    "/{documentId}",
    operation_id="getCreditApplication",
    response_model=CreditApplication,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ},
)
def get_credit_application(documentId: Id, principal: Reader, service: Service, response: Response):
    item = service.get(int(documentId))
    response.headers["ETag"] = service.etag(item)
    return item


@router.post(
    "",
    operation_id="createCreditApplication",
    response_model=MutationResult,
    status_code=201,
    responses=responses(201, 400, 401, 403, 404, 409, 415, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def create_credit_application(
    body: CreditApplicationCreate, principal: Writer, service: Service, key: Key
):
    result = service.create(body, key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.patch(
    "/{documentId}",
    operation_id="updateCreditApplicationDraft",
    response_model=CreditApplication,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def update_credit_application(
    documentId: Id,
    body: CreditApplicationUpdate,
    principal: Writer,
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
    operation_id="postCreditApplication",
    response_model=MutationResult,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def post_credit_application(
    documentId: Id,
    principal: Writer,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = service.post(int(documentId), read_preconditions(request), key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)
