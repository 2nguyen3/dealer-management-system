from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import Request, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.responses import (
    api_error_response,
    auth_error_response,
    business_path,
)
from app.core.exceptions import ApiError, AuthError
from app.modules.auth.permissions import FUNCTION_CODES


async def request_context(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    request.state.request_id = str(uuid4())
    auth_path = request.url.path.startswith("/api/v1/auth/")
    try:
        if auth_path:
            from app.modules.auth.rate_limit import build_rate_limit_key

            settings = request.app.state.settings
            address = request.client.host if request.client else "unknown"
            limiter = request.app.state.auth_limiter
            limiter.check(
                build_rate_limit_key("auth", address),
                settings.auth_rate_limit,
                settings.auth_rate_window_seconds,
            )
            if request.url.path == "/api/v1/auth/password-resets":
                limiter.check(
                    build_rate_limit_key("reset", address),
                    settings.auth_reset_limit,
                    settings.auth_reset_window_seconds,
                )
        if auth_path and request.method in ("POST", "PUT"):
            media = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
            if media != "application/json":
                raise AuthError(415, "UNSUPPORTED_MEDIA_TYPE", "JSON content type required")
        response = await call_next(request)
    except ApiError as error:
        response = api_error_response(request, error)
    except AuthError as error:
        response = auth_error_response(request, error)
    except Exception:
        if business_path(request):
            response = api_error_response(
                request, ApiError(500, "INTERNAL_ERROR", "Internal server error")
            )
        elif not auth_path:
            raise
        else:
            response = auth_error_response(
                request, AuthError(500, "INTERNAL_ERROR", "Internal server error")
            )
    response.headers["X-Request-Id"] = request.state.request_id
    if auth_path:
        response.headers["Cache-Control"] = "no-store"
    return response


def set_audit_context(
    session: Session,
    actor_id: int | None,
    request_id: str,
    *,
    function_code: str = "users.manage",
) -> None:
    if function_code not in FUNCTION_CODES:
        raise ValueError("Unknown audit function code")
    session.execute(
        text(
            "SELECT set_config('dms.actor_id', :actor, true), "
            "set_config('dms.request_id', :request, true), "
            "set_config('dms.function_code', :function, true)"
        ),
        {
            "actor": "" if actor_id is None else str(actor_id),
            "request": request_id,
            "function": function_code,
        },
    )
