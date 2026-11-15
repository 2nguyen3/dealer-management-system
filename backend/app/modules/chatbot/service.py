"""POST /chatbot/messages: authenticate, then let the LLM use the Agentra MCP tools.

The backend does not read business tables for the assistant: every figure comes from an
MCP tool, which calls the public API with the user's own token (same RBAC as the UI).
"""

import asyncio
import logging
import time
from collections.abc import Callable

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError
from app.modules.auth.service import AuthService, utc_now
from app.modules.auth.tokens import decode_access_token
from app.modules.chatbot import mcp_client
from app.modules.chatbot.llm import LLMClient, LLMUnavailable
from app.modules.chatbot.orchestrator import Orchestrator
from app.modules.chatbot.schemas import ChatbotMessageRequest, ChatbotReply

logger = logging.getLogger("app.chatbot")


def unavailable() -> ApiError:
    return ApiError(503, "CHATBOT_UNAVAILABLE", "The assistant is not available right now")


class ChatbotService:
    def __init__(
        self,
        engine,
        settings,
        delivery,
        *,
        limiter: Callable[[int], None] | None = None,
        client: LLMClient | None = None,
        connect=None,
    ):
        self.engine, self.settings, self.delivery = engine, settings, delivery
        self.limiter = limiter
        self.client = client
        self.connect = connect or mcp_client.connect

    def _admit(self, token: str) -> tuple[int, str]:
        """Live session check (short read-only transaction) and the business date."""
        decode_access_token(self.settings, token, utc_now())
        with self.engine.connect() as connection:
            connection = connection.execution_options(postgresql_readonly=True)
            with connection.begin(), Session(bind=connection) as session:
                auth = AuthService(session, self.settings, self.delivery, memoize=True)
                principal = auth.authenticate(token)
                today = session.execute(text("SELECT dms.business_today()")).scalar_one()
        return principal.user_id, today.isoformat()

    def _client(self) -> LLMClient:
        if self.client is not None:
            return self.client
        return LLMClient(
            self.settings.chatbot_llm_base_url,
            self.settings.chatbot_llm_api_key.get_secret_value(),
            self.settings.chatbot_models(),
            self.settings.chatbot_llm_timeout_seconds,
        )

    def send(self, token: str, request: ChatbotMessageRequest) -> ChatbotReply:
        user_id, today = self._admit(token)
        if not self.settings.chatbot_ready():
            raise unavailable()
        if self.limiter is not None:
            self.limiter(user_id)
        if request.messages[-1].role != "user":
            raise ApiError(422, "VALIDATION_FAILED", "The last message must come from the user")
        started = time.monotonic()
        turns = [turn.model_dump() for turn in request.messages]
        try:
            reply = asyncio.run(self._run(token, turns, today, request.locale))
        except (LLMUnavailable, mcp_client.McpUnavailable) as error:
            logger.warning("chatbot unavailable for user %s: %r", user_id, error)
            raise unavailable() from None
        logger.info(
            "chatbot user=%s tools=%s model=%s ms=%d",
            user_id,
            ",".join(reply["tools"]),
            reply["model"],
            (time.monotonic() - started) * 1000,
        )
        return ChatbotReply.model_validate(reply)

    async def _run(self, token: str, turns: list[dict], today: str, locale: str) -> dict:
        orchestrator = Orchestrator(
            self._client(),
            self.settings.chatbot_max_tool_steps,
            self.settings.chatbot_deadline_seconds,
        )
        async with self.connect(
            self.settings.chatbot_mcp_url, token, self.settings.chatbot_llm_timeout_seconds
        ) as tools:
            return await orchestrator.run(tools, turns, today, locale)
