"""POST /chatbot/messages: authenticate, admit, then answer through the semantic engine.

No database connection is held while the LLM thinks: authentication runs in one short
read-only transaction, and every tool call opens its own read-only snapshot.
"""

import logging
import time
from collections.abc import Callable
from contextlib import contextmanager

from pydantic import TypeAdapter
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError, AuthError
from app.modules.auth.service import AuthService, utc_now
from app.modules.auth.tokens import decode_access_token
from app.modules.chatbot.engine import SemanticQueryEngine, ToolError
from app.modules.chatbot.llm import LLMClient, LLMUnavailable
from app.modules.chatbot.orchestrator import Orchestrator, selection_reply, template
from app.modules.chatbot.repository import ChatbotRepository
from app.modules.chatbot.schemas import ChatbotMessageRequest, ChatbotReply
from app.modules.chatbot.semantic_model import ADMISSION

logger = logging.getLogger("app.chatbot")
REPLY = TypeAdapter(ChatbotReply)


def unavailable(message: str = "The assistant is not available right now") -> ApiError:
    return ApiError(503, "CHATBOT_UNAVAILABLE", message)


class ChatbotService:
    def __init__(
        self,
        engine,
        settings,
        delivery,
        *,
        limiter: Callable[[int], None] | None = None,
        client: LLMClient | None = None,
    ):
        self.engine, self.settings, self.delivery = engine, settings, delivery
        self.limiter = limiter
        self.client = client

    @contextmanager
    def _read(self):
        with self.engine.connect() as connection:
            connection = connection.execution_options(
                isolation_level="REPEATABLE READ", postgresql_readonly=True
            )
            with connection.begin(), Session(bind=connection) as session:
                yield session

    @contextmanager
    def _repository(self):
        with self._read() as session:
            yield ChatbotRepository(session)

    def _admit(self, token: str):
        decode_access_token(self.settings, token, utc_now())
        with self._read() as session:
            auth = AuthService(session, self.settings, self.delivery, memoize=True)
            principal = auth.authenticate(token)
            allowed = frozenset(auth.get_current_user(principal).allowedFunctions)
            if not allowed.intersection(ADMISSION):
                raise AuthError(403, "FORBIDDEN", "Permission denied")
            today = session.execute(text("SELECT dms.business_today()")).scalar_one()
        return principal.user_id, allowed, today

    def _client(self) -> LLMClient:
        if self.client is not None:
            return self.client
        return LLMClient(
            self.settings.chatbot_llm_base_url,
            self.settings.chatbot_llm_api_key.get_secret_value(),
            self.settings.chatbot_models(),
            self.settings.chatbot_llm_timeout_seconds,
        )

    def send(self, token: str, request: ChatbotMessageRequest):
        user_id, allowed, today = self._admit(token)
        if not self.settings.chatbot_ready():
            raise unavailable()
        if self.limiter is not None:
            self.limiter(user_id)
        if request.resume is None and request.messages[-1].role != "user":
            raise ApiError(422, "VALIDATION_FAILED", "The last message must come from the user")
        engine = SemanticQueryEngine(self._repository, allowed, today, request.locale)
        started = time.monotonic()
        if request.resume is not None:
            reply = self._resume(engine, request)
        else:
            orchestrator = Orchestrator(
                self._client(),
                self.settings.chatbot_max_tool_steps,
                self.settings.chatbot_deadline_seconds,
            )
            turns = [turn.model_dump() for turn in request.messages]
            try:
                reply = orchestrator.run(engine, turns, request.locale)
            except LLMUnavailable as error:
                logger.warning("chatbot unavailable for user %s: %s", user_id, error)
                raise unavailable() from None
        logger.info(
            "chatbot user=%s status=%s model=%s ms=%d",
            user_id,
            reply["status"],
            reply.get("model"),
            (time.monotonic() - started) * 1000,
        )
        return REPLY.validate_python(reply)

    @staticmethod
    def _resume(engine: SemanticQueryEngine, request: ChatbotMessageRequest) -> dict:
        query = request.resume.query.model_dump(exclude_none=True)
        select = request.resume.select.model_dump()
        try:
            table = engine.query(query, select=select)
        except ToolError as error:
            if error.code == "AMBIGUOUS_ENTITY":
                # Keep the code the user already picked; ask for the other entity.
                picked = {"field": select["entity"], "op": "eq", "value": select["code"]}
                kept = [f for f in query["filters"] if f["field"] != select["entity"]]
                query = {**query, "filters": [*kept, picked]}
                return selection_reply(error, query, request.locale)
            if error.code in {"FORBIDDEN_METRIC", "NO_MATCH"}:
                return {"status": "REFUSED", "answer": error.message, "reason": error.code}
            if error.code == "MISSING_FIELD":
                return {
                    "status": "NEEDS_INFO",
                    "answer": template("missing", request.locale),
                    "missing": list(error.details.get("missing") or ["period"]),
                }
            raise ApiError(422, "VALIDATION_FAILED", error.message) from None
        return {
            "status": "ANSWERED",
            "answer": template("resumed", request.locale, code=select["code"]),
            "tables": [table],
            "model": None,
        }
