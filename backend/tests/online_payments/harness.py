"""Minimal app and VNPAY fixtures for online payment tests.

The app mounts only the authentication, online payment and VNPAY routers with the
production error handlers/middleware, so these tests do not depend on unrelated
modules being importable.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import APIRouter, FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException

from app.common.responses import (
    api_error_handler,
    auth_error_handler,
    http_error_handler,
    validation_error_handler,
)
from app.core.config import Settings
from app.core.exceptions import ApiError, AuthError
from app.core.request_context import request_context
from app.modules.auth.delivery import SmtpResetDelivery
from app.modules.auth.rate_limit import AuthRateLimiter
from app.modules.auth.router import router as auth_router
from app.modules.online_payments.router import router as online_payments_router
from app.modules.online_payments.vnpay import VN, checksum
from app.modules.online_payments.vnpay_router import router as vnpay_router

SECRET = "synthetic-native-vnpay-secret"
TMN_CODE = "TEST1234"


def config(**values) -> Settings:
    return Settings(
        _env_file=None,
        db_host="localhost",
        db_user="test",
        db_password="test",
        auth_signing_key="synthetic-native-key-at-least-32-bytes",
        vnpay_tmn_code=TMN_CODE,
        vnpay_hash_secret=SECRET,
        vnpay_ipn_url="https://callback.test/ipn",
        vnpay_return_url="https://callback.test/return",
        **values,
    )


def build_app(settings: Settings, engine=None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.engine = engine
        yield

    app = FastAPI(lifespan=lifespan)
    app.state.settings = settings
    app.state.reset_delivery = SmtpResetDelivery(settings)
    app.state.auth_limiter = AuthRateLimiter(settings.auth_rate_limit_max_buckets)
    app.middleware("http")(request_context)
    app.add_exception_handler(AuthError, auth_error_handler)
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(HTTPException, http_error_handler)
    api = APIRouter()
    api.include_router(auth_router)
    api.include_router(vnpay_router)
    api.include_router(online_payments_router)
    app.include_router(api, prefix="/api/v1")
    return app


def ipn_fields(
    reference: str,
    amount,
    *,
    status: str = "00",
    response: str | None = None,
    transaction: str = "14123456",
    paid_at: datetime | None = None,
    tmn_code: str = TMN_CODE,
) -> dict[str, str]:
    """Signed VNPAY IPN/Return query parameters as the gateway sends them."""
    paid_at = paid_at or datetime.now(UTC)
    fields = {
        "vnp_TmnCode": tmn_code,
        "vnp_Amount": str(int(amount) * 100),
        "vnp_BankCode": "NCB",
        "vnp_BankTranNo": "VNP" + transaction,
        "vnp_CardType": "ATM",
        "vnp_OrderInfo": "Agentra payment " + reference,
        "vnp_PayDate": paid_at.astimezone(VN).strftime("%Y%m%d%H%M%S"),
        "vnp_ResponseCode": response or status,
        "vnp_TransactionNo": transaction,
        "vnp_TransactionStatus": status,
        "vnp_TxnRef": reference,
    }
    return {**fields, "vnp_SecureHash": checksum(fields, SECRET)}
