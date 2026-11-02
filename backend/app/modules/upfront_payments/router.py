from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Response
from fastapi.responses import JSONResponse

from app.common.catalogue_http import MatchHeader, responses
from app.common.preconditions import read_preconditions
from app.common.schemas import Cursor, Id, Instant, Limit
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.stock_receipts.schemas import Reason
from app.modules.upfront_payments.dependencies import get_upfront_service
from app.modules.upfront_payments.schemas import (
    UpfrontConfirmation,
    UpfrontCreate,
    UpfrontList,
    UpfrontSeparated,
    UpfrontState,
)
from app.modules.upfront_payments.service import UpfrontPaymentService

router = APIRouter(
    prefix="/upfront-confirmations", tags=["Upfront Payments"], route_class=BusinessRoute
)
READ = {"anyOf": ["cash.upfront.verify", "cash.receipt.post", "stock.issue.post"]}
VERIFY = {"allOf": ["cash.upfront.verify"]}
POST = {"allOf": ["cash.receipt.post"]}
Reader = Annotated[Principal, Depends(require_permissions(any_of=tuple(READ["anyOf"])))]
Verifier = Annotated[Principal, Depends(require_permissions(all_of=("cash.upfront.verify",)))]
Poster = Annotated[Principal, Depends(require_permissions(all_of=("cash.receipt.post",)))]
Service = Annotated[UpfrontPaymentService, Depends(get_upfront_service)]
Key = Annotated[UUID, Header(alias="Idempotency-Key")]


@router.get(
    "",
    operation_id="listUpfrontConfirmations",
    response_model=UpfrontList,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_upfront_confirmations(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    agencyId: Id | None = None,
    issueDocumentId: Id | None = None,
    state: UpfrontState | None = None,
    createdFrom: Instant | None = None,
    createdTo: Instant | None = None,
    sort: Literal["id", "-id", "createdAt", "-createdAt"] = "-createdAt",
):
    return service.list(
        limit=limit,
        cursor=cursor,
        agencyId=agencyId,
        issueDocumentId=issueDocumentId,
        state=state,
        createdFrom=createdFrom,
        createdTo=createdTo,
        sort=sort,
    )


@router.get(
    "/{confirmationId}",
    operation_id="getUpfrontConfirmation",
    response_model=UpfrontConfirmation,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ},
)
def get_upfront_confirmation(
    confirmationId: Id, principal: Reader, service: Service, response: Response
):
    item = service.get(int(confirmationId))
    response.headers["ETag"] = service.etag(item)
    return item


@router.post(
    "",
    operation_id="verifyUpfrontPayment",
    response_model=UpfrontConfirmation,
    status_code=201,
    responses=responses(201, 400, 401, 403, 404, 409, 415, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": VERIFY},
)
def verify_upfront_payment(body: UpfrontCreate, principal: Verifier, service: Service, key: Key):
    result = service.verify(body, key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.post(
    "/{confirmationId}/receive-separately",
    operation_id="receiveUpfrontSeparately",
    response_model=UpfrontSeparated,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": POST},
)
def receive_upfront_separately(
    confirmationId: Id,
    body: Reason,
    principal: Poster,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = service.separate(int(confirmationId), body, read_preconditions(request), key)
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)
