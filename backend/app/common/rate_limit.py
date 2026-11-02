from fastapi import Request

from app.common.transport import matched_operation
from app.core.exceptions import ApiError, AuthError
from app.modules.auth.rate_limit import build_rate_limit_key


def check_business_limit(request: Request, actor_id: int) -> None:
    operation = matched_operation(request)
    if operation is None:
        raise ValueError("Business limiter requires a matched operation")
    peer = request.client.host if request.client else "unknown"
    settings = request.app.state.settings
    key = build_rate_limit_key(f"business:{operation}:{actor_id}", peer)
    try:
        request.app.state.auth_limiter.check(
            key, settings.api_rate_limit, settings.api_rate_window_seconds
        )
    except AuthError as error:
        raise ApiError(
            error.status,
            error.code,
            error.message,
            headers={"Retry-After": str(error.retry_after)},
        ) from None
