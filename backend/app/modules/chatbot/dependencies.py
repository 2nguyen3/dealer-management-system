from fastapi import Request

from app.core.exceptions import ApiError, AuthError
from app.modules.auth.rate_limit import build_rate_limit_key
from app.modules.chatbot.service import ChatbotService


def chatbot_limiter(request: Request):
    """Per-user `chatbot` bucket, separate from the generic HTTP bucket (LLM cost)."""

    def check(actor_id: int) -> None:
        settings = request.app.state.settings
        peer = request.client.host if request.client else "unknown"
        key = build_rate_limit_key(f"chatbot:{actor_id}", peer)
        try:
            request.app.state.auth_limiter.check(
                key, settings.chatbot_rate_limit, settings.chatbot_rate_window_seconds
            )
        except AuthError as error:
            raise ApiError(
                error.status,
                error.code,
                error.message,
                headers={"Retry-After": str(error.retry_after)},
            ) from None

    return check


def get_chatbot_service(request: Request) -> ChatbotService:
    return ChatbotService(
        request.app.state.engine,
        request.app.state.settings,
        request.app.state.reset_delivery,
        limiter=chatbot_limiter(request),
    )
