from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException

from app.api.router import router
from app.common.responses import (
    api_error_handler,
    auth_error_handler,
    http_error_handler,
    validation_error_handler,
)
from app.core.config import Settings, get_settings, validate_auth_startup_settings
from app.core.exceptions import ApiError, AuthError
from app.core.request_context import request_context
from app.db.session import build_engine
from app.modules.auth.delivery import SmtpResetDelivery
from app.modules.auth.rate_limit import AuthRateLimiter


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    validate_auth_startup_settings(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = build_engine(settings.database_url())
        app.state.engine = engine
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )
    app.state.settings = settings
    app.state.reset_delivery = SmtpResetDelivery(settings)
    app.state.auth_limiter = AuthRateLimiter(settings.auth_rate_limit_max_buckets)
    app.middleware("http")(request_context)
    app.add_exception_handler(AuthError, auth_error_handler)
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(HTTPException, http_error_handler)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-Request-Id",
            "If-Match",
            "If-None-Match",
            "Idempotency-Key",
        ],
        expose_headers=[
            "X-Request-Id",
            "Retry-After",
            "WWW-Authenticate",
            "ETag",
            "Location",
            "Content-Disposition",
        ],
    )
    app.include_router(router, prefix="/api/v1")
    return app
