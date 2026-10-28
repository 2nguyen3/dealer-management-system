"""Native provider transports; not additional canonical business operations."""

from html import escape
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, JSONResponse

from app.common.rate_limit import check_business_limit
from app.core.exceptions import ApiError
from app.modules.online_payments.dependencies import get_webhook_service
from app.modules.online_payments.service import OnlinePaymentService
from app.modules.online_payments.vnpay import VnpayAdapter

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
    return JSONResponse({"RspCode": code, "Message": message}, headers=HEADERS)


@router.get("/return")
def vnpay_return(request: Request):
    try:
        adapter = native_adapter(request)
        fields = adapter.verify_callback(request.query_params.multi_items())
        reference = fields.get("vnp_TxnRef", "")
    except ApiError as error:
        return HTMLResponse(
            "<html lang='vi'><meta charset='utf-8'>"
            "<h1>Không xác minh được kết quả VNPAY</h1></html>",
            status_code=503 if error.status == 503 else 400,
            headers=HEADERS,
        )
    return HTMLResponse(
        "<!doctype html><html lang='vi'><head><meta charset='utf-8'>"
        "<title>Kết quả VNPAY</title></head><body><h1>Đã trở về từ VNPAY</h1>"
        f"<p>Mã tham chiếu: {escape(reference)}</p>"
        "<p>Vui lòng kiểm tra trạng thái thanh toán trong Agentra. "
        "Kết quả được ghi nhận qua IPN hoặc đối soát từ máy chủ.</p></body></html>",
        headers=HEADERS,
    )
