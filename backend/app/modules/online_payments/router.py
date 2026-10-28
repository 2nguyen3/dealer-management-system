import json
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Response
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from app.common.catalogue_http import responses
from app.common.preconditions import canonical_etag
from app.common.rate_limit import check_business_limit
from app.common.schemas import Cursor, Id, Instant, Limit, NonEmptyText
from app.common.transport import BusinessRoute
from app.core.exceptions import ApiError
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.online_payments.adapter import verify_signature
from app.modules.online_payments.dependencies import get_online_payment_service, get_webhook_service
from app.modules.online_payments.schemas import (
    OnlinePayment,
    OnlinePaymentCreate,
    OnlinePaymentList,
    PaymentEventList,
    PaymentStatus,
    VerifiedPayment,
    WebhookAcknowledgement,
)
from app.modules.online_payments.service import OnlinePaymentService


def payment_responses(*statuses, **kwargs):
    result = responses(*statuses, **kwargs)
    if 503 in result:
        result[503]["headers"]["Retry-After"] = {"schema": {"type": "integer", "minimum": 1}}
    return result


router = APIRouter(prefix="/online-payments", tags=["Online Payments"], route_class=BusinessRoute)
webhook_router = APIRouter(tags=["Online Payments"])
READ = {"anyOf": ["payments.online", "debt.read"]}
WRITE = {"allOf": ["payments.online"]}
Reader = Annotated[Principal, Depends(require_permissions(any_of=tuple(READ["anyOf"])))]
Writer = Annotated[Principal, Depends(require_permissions(all_of=("payments.online",)))]
Service = Annotated[OnlinePaymentService, Depends(get_online_payment_service)]
Key = Annotated[UUID, Header(alias="Idempotency-Key")]
WebhookSignature = APIKeyHeader(
    name="X-Webhook-Signature", scheme_name="WebhookSignature", auto_error=False
)
CREATE_RESPONSES = payment_responses(
    201, 202, 400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, etag=True
)
CREATE_RESPONSES[202]["headers"].update(
    {
        "Location": {"schema": {"type": "string", "format": "uri-reference"}},
        "Retry-After": {"schema": {"type": "integer", "minimum": 1}},
    }
)
CREATE_RESPONSES[202]["content"] = {
    "application/json": {"schema": OnlinePayment.model_json_schema()}
}


@router.get(
    "",
    operation_id="listOnlinePayments",
    response_model=OnlinePaymentList,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
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
    responses=CREATE_RESPONSES,
    openapi_extra={"x-permissions": WRITE},
)
def create_online_payment(body: OnlinePaymentCreate, principal: Writer, service: Service, key: Key):
    result = service.create(body, key)
    headers = dict(result.headers)
    if result.status == 202:
        headers["Retry-After"] = "5"
    else:
        headers["ETag"] = canonical_etag(f"online-payment:{result.body['id']}", result.body)
    return JSONResponse(result.body, status_code=result.status, headers=headers)


@router.get(
    "/{paymentId}",
    operation_id="getOnlinePayment",
    response_model=OnlinePayment,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ},
)
def get_online_payment(paymentId: Id, principal: Reader, service: Service, response: Response):
    item = service.get(int(paymentId))
    response.headers["ETag"] = canonical_etag(
        f"online-payment:{item.id}", item.model_dump(mode="json")
    )
    return item


@router.get(
    "/{paymentId}/events",
    operation_id="listPaymentEvents",
    response_model=PaymentEventList,
    responses=responses(200, 400, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": WRITE},
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
    responses=payment_responses(200, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def reconcile_online_payment(
    paymentId: Id, principal: Writer, service: Service, key: Key, response: Response
):
    item = service.reconcile(int(paymentId), key)
    response.headers["ETag"] = canonical_etag(
        f"online-payment:{item.id}", item.model_dump(mode="json")
    )
    return item


@webhook_router.post(
    "/payment-webhooks/{provider}",
    operation_id="receiveVerifiedPaymentWebhook",
    response_model=WebhookAcknowledgement,
    responses=payment_responses(200, 400, 401, 404, 409, 415, 422, 429, 500, 503),
    openapi_extra={
        "x-raw-body": True,
        "requestBody": {
            "required": True,
            "content": {"application/json": {"schema": VerifiedPayment.model_json_schema()}},
        },
        "parameters": [
            {
                "name": "X-Webhook-Timestamp",
                "in": "header",
                "required": True,
                "schema": {"type": "string", "pattern": "^[0-9]+$"},
            },
            {
                "name": "X-Webhook-Key-Id",
                "in": "header",
                "required": True,
                "schema": {"type": "string", "minLength": 1, "pattern": r"\S"},
            },
        ],
    },
)
async def payment_webhook(
    provider: NonEmptyText,
    request: Request,
    service: Annotated[OnlinePaymentService, Depends(get_webhook_service)],
    signature: Annotated[str | None, Depends(WebhookSignature)] = None,
):
    settings = request.app.state.settings
    check_business_limit(request, None)
    names = ("x-webhook-timestamp", "x-webhook-key-id", "x-webhook-signature")
    values = [request.headers.getlist(name) for name in names]
    if provider != settings.payment_provider or any(len(value) != 1 for value in values):
        raise ApiError(401, "INVALID_SIGNATURE", "Webhook signature is invalid")
    raw = await request.body()
    verify_signature(raw, *(value[0] for value in values), settings.payment_webhook_keys)
    if request.headers.get("content-type", "").split(";")[0].strip().lower() != "application/json":
        raise ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "JSON content type required")
    try:
        parsed = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise ApiError(400, "INVALID_JSON", "Malformed JSON") from None
    try:
        evidence = VerifiedPayment.model_validate(parsed)
    except ValidationError:
        raise ApiError(422, "VALIDATION_FAILED", "Invalid payment evidence") from None
    result, duplicate = await run_in_threadpool(service.complete, provider, evidence)
    return WebhookAcknowledgement(
        accepted=True,
        duplicate=duplicate,
        paymentId=result.id,
        status=result.status,
        receiptDocumentId=result.receiptDocumentId,
    )
