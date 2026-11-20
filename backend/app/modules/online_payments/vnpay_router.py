"""Native provider transports; not additional canonical business operations."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, JSONResponse

from app.common.rate_limit import check_business_limit
from app.core.exceptions import ApiError
from app.modules.online_payments.dependencies import get_webhook_service
from app.modules.online_payments.return_page import (
    PAGE_HEADERS,
    provider_paid,
    render_invalid,
    render_return,
)
from app.modules.online_payments.service import OnlinePaymentService
from app.modules.online_payments.vnpay import VnpayAdapter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/integrations/vnpay", include_in_schema=False)
HEADERS = {"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"}


def native_adapter(request):
    settings = request.app.state.settings
    if not settings.vnpay_tmn_code or not settings.vnpay_hash_secret.get_secret_value():
        raise ApiError(503, "PROVIDER_UNAVAILABLE", "VNPAY is not configured")
    return VnpayAdapter(settings)


@router.get("/ipn")
def vnpay_ipn(
    request: Request,
    service: Annotated[OnlinePaymentService, Depends(get_webhook_service)],
):
    code, message = "99", "Please retry"
    try:
        check_business_limit(request, None)
        adapter = native_adapter(request)
        fields = adapter.verify_callback(request.query_params.multi_items())
        evidence = adapter.payment_evidence(fields)
        _, duplicate = service.complete("VNPAY", evidence)
        code, message = (
            ("02", "Order already confirmed") if duplicate else ("00", "Confirm Success")
        )
    except ApiError as error:
        if error.code == "INVALID_SIGNATURE":
            code, message = "97", "Invalid signature"
        elif error.code == "NOT_FOUND":
            code, message = "01", "Order not found"
        elif error.code == "PAYMENT_CONFLICT" and "amount" in error.message:
            code, message = "04", "Invalid amount"
    except Exception:  # VNPAY retries "99"; an IPN never surfaces as HTTP 500
        logger.exception("VNPAY IPN processing failed")
    return JSONResponse({"RspCode": code, "Message": message}, headers=HEADERS)


@router.get("/return")
def vnpay_return(
    request: Request,
    service: Annotated[OnlinePaymentService, Depends(get_webhook_service)],
):
    """Payer-facing receipt page; success only after the server recorded the payment."""
    try:
        adapter = native_adapter(request)
        fields = adapter.verify_callback(request.query_params.multi_items())
    except ApiError as error:
        return HTMLResponse(
            render_invalid(),
            status_code=503 if error.status == 503 else 400,
            headers=PAGE_HEADERS,
        )
    view = None
    try:
        try:
            check_business_limit(request, None)
            may_query = provider_paid(fields)
        except ApiError:  # rate limited: show the recorded state without querying VNPAY
            may_query = False
        view = service.payer_outcome(fields.get("vnp_TxnRef", ""), reconcile=may_query)
    except Exception:  # the page still renders from the verified return parameters
        logger.exception("VNPAY return lookup failed")
    reload_url = request.url.path + ("?" + request.url.query if request.url.query else "")
    return HTMLResponse(render_return(fields, view, reload_url), headers=PAGE_HEADERS)
