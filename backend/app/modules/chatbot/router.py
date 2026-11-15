from typing import Annotated

from fastapi import APIRouter, Depends, Response
from fastapi.security import HTTPAuthorizationCredentials

from app.common.catalogue_http import responses
from app.common.transport import BusinessRoute
from app.core.exceptions import AuthError
from app.modules.auth.dependencies import bearer
from app.modules.chatbot.dependencies import get_chatbot_service
from app.modules.chatbot.schemas import ChatbotMessageRequest, ChatbotReply
from app.modules.chatbot.service import ChatbotService

router = APIRouter(tags=["Chatbot"], route_class=BusinessRoute)


@router.post(
    "/chatbot/messages",
    operation_id="sendChatbotMessage",
    summary="Ask the read-only assistant about agencies, products, documents and reports",
    response_model=ChatbotReply,
    response_model_exclude_none=True,
    responses=responses(200, 400, 401, 415, 422, 429, 500, 503),
    openapi_extra={
        "x-permissions": {
            "conditional": (
                "Authenticated; each MCP tool applies the permissions of the operation it wraps"
            )
        }
    },
)
def send_chatbot_message(
    body: ChatbotMessageRequest,
    response: Response,
    service: Annotated[ChatbotService, Depends(get_chatbot_service)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AuthError(401, "INVALID_OR_EXPIRED_TOKEN", "Bearer authentication required")
    response.headers["Cache-Control"] = "no-store"
    return service.send(credentials.credentials, body)
