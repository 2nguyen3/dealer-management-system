"""Minimal OpenAI-compatible chat-completions client with a model fallback list.

Works with OpenRouter, a local 9router, or any `/v1/chat/completions` endpoint that
supports `tools`. The API key is optional (local routers) and never logged.
"""

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger("app.chatbot")


class LLMUnavailable(Exception):
    """Every configured model failed or timed out."""


@dataclass(frozen=True)
class LLMReply:
    model: str
    content: str
    tool_calls: list[dict]


class LLMClient:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        models: list[str],
        timeout: float,
        transport: httpx.BaseTransport | None = None,
    ):
        self.url = base_url.rstrip("/") + "/chat/completions"
        self.models = list(models)
        self.headers = {"Content-Type": "application/json"}
        if api_key:
            self.headers["Authorization"] = f"Bearer {api_key}"
        self.timeout = timeout
        self.transport = transport

    def chat(self, messages: list[dict], tools: list[dict]) -> LLMReply:
        last = "no model configured"
        with httpx.Client(timeout=self.timeout, transport=self.transport) as client:
            for model in self.models:
                body = {
                    "model": model,
                    "messages": messages,
                    "tools": tools,
                    "tool_choice": "auto",
                    "stream": False,
                    "temperature": 0.1,
                }
                try:
                    response = client.post(self.url, json=body, headers=self.headers)
                except httpx.HTTPError as error:
                    last = f"{model}: {type(error).__name__}"
                    logger.warning("chatbot model transport failure: %s", last)
                    continue
                if response.status_code != 200:
                    last = f"{model}: HTTP {response.status_code}"
                    logger.warning("chatbot model rejected request: %s", last)
                    continue
                reply = self._parse(model, response)
                if reply is not None:
                    return reply
                last = f"{model}: malformed response"
                logger.warning("chatbot model returned malformed JSON: %s", model)
        raise LLMUnavailable(last)

    @staticmethod
    def _parse(model: str, response: httpx.Response) -> LLMReply | None:
        try:
            message = response.json()["choices"][0]["message"]
        except (ValueError, KeyError, IndexError, TypeError):
            return None
        if not isinstance(message, dict):
            return None
        content = message.get("content") or ""
        if isinstance(content, list):  # some providers return content parts
            content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
        calls = message.get("tool_calls") or []
        if not isinstance(calls, list):
            return None
        valid = [
            call
            for call in calls
            if isinstance(call, dict)
            and isinstance(call.get("function"), dict)
            and isinstance(call["function"].get("name"), str)
        ]
        return LLMReply(model=model, content=str(content).strip(), tool_calls=valid)
