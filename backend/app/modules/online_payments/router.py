from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Response
from fastapi.responses import JSONResponse

from app.common.catalogue_http import responses
from app.common.preconditions import canonical_etag
from app.common.schemas import Cursor, Id, Instant, Limit, NonEmptyText
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.online_payments.dependencies import get_online_payment_service
from app.modules.online_payments.schemas import (
    OnlinePayment,
    OnlinePaymentCreate,
    OnlinePaymentList,
    PaymentEventList,
    PaymentStatus,
)
from app.modules.online_payments.service import READ, WRITE, OnlinePaymentService


def payment_responses(*statuses, **kwargs):
    result = responses(*statuses, **kwargs)
    if 503 in result:
        result[503]["headers"]["Retry-After"] = {"schema": {"type": "integer", "minimum": 1}}
    return result


def etag(item: OnlinePayment) -> str:
    # The checkout URL is re-signed per request (client IP), so it is not part of the tag.
    return canonical_etag(
        f"online-payment:{item.id}", item.model_dump(mode="json", exclude={"checkoutUrl"})
    )


router = APIRouter(prefix="/online-payments", tags=["Online Payments"], route_class=BusinessRoute)
Reader = Annotated[Principal, Depends(require_permissions(any_of=READ))]
Writer = Annotated[Principal, Depends(require_permissions(all_of=WRITE))]
Service = Annotated[OnlinePaymentService, Depends(get_online_payment_service)]
OptionalKey = Annotated[UUID | None, Header(alias="Idempotency-Key")]
READ_PERMISSIONS = {"x-permissions": {"anyOf": list(READ)}}
WRITE_PERMISSIONS = {"x-permissions": {"allOf": list(WRITE)}}


@router.get(
    "",
    operation_id="listOnlinePayments",
    response_model=OnlinePaymentList,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra=READ_PERMISSIONS,
)
def list_online_payments(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    agencyId: Id | None = None,
    status: PaymentStatus | None = None,
    merchantReference: NonEmptyText | None = None,
    providerTransactionId: NonEmptyText | None = None,
    provider: NonEmptyText | None = None,
    createdFrom: Instant | None = None,
    createdTo: Instant | None = None,
    sort: Literal["id", "-id", "createdAt", "-createdAt"] = "-createdAt",
):
    return service.list(
        limit=limit,
        cursor=cursor,
        sort=sort,
        agencyId=agencyId,
        status=status,
        merchantReference=merchantReference,
        providerTransactionId=providerTransactionId,
        provider=provider,
        createdFrom=createdFrom,
        createdTo=createdTo,
    )


@router.post(
    "",
    operation_id="createOnlinePayment",
    response_model=OnlinePayment,
    status_code=201,
    responses=payment_responses(201, 400, 401, 403, 404, 409, 415, 422, 429, 500, 503, etag=True),
    openapi_extra=WRITE_PERMISSIONS,
)
def create_online_payment(
    body: OnlinePaymentCreate, principal: Writer, service: Service, key: OptionalKey = None
):
    """A repeated Idempotency-Key returns the payment created by the first request."""
    item = service.create(body, key)
    return JSONResponse(
        item.model_dump(mode="json"),
        status_code=201,
        headers={"Location": f"/api/v1/online-payments/{item.id}", "ETag": etag(item)},
    )


@router.get(
    "/{paymentId}",
    operation_id="getOnlinePayment",
    response_model=OnlinePayment,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra=READ_PERMISSIONS,
)
def get_online_payment(paymentId: Id, principal: Reader, service: Service, response: Response):
    item = service.get(int(paymentId))
    response.headers["ETag"] = etag(item)
    return item


@router.get(
    "/{paymentId}/events",
    operation_id="listPaymentEvents",
    response_model=PaymentEventList,
    responses=responses(200, 400, 401, 403, 404, 422, 429, 500),
    openapi_extra=WRITE_PERMISSIONS,
)
def list_payment_events(
    paymentId: Id,
    principal: Writer,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    providerStatus: PaymentStatus | None = None,
    sort: Literal["id", "-id", "createdAt", "-createdAt"] = "-createdAt",
):
    return service.events(
        int(paymentId), limit=limit, cursor=cursor, sort=sort, providerStatus=providerStatus
    )


@router.post(
    "/{paymentId}/reconcile",
    operation_id="reconcileOnlinePayment",
    response_model=OnlinePayment,
    responses=payment_responses(200, 401, 403, 404, 409, 422, 429, 500, 502, 503, etag=True),
    openapi_extra=WRITE_PERMISSIONS,
)
def reconcile_online_payment(
    paymentId: Id, principal: Writer, service: Service, response: Response
):
    """Only PENDING payments are queried at VNPAY; terminal payments return 409."""
    item = service.reconcile(int(paymentId))
    response.headers["ETag"] = etag(item)
    return item
