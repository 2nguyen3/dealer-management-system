"""Web-assistant tool loop: tools come from the Agentra MCP server (`tools/list`); the LLM
only chooses tools and arguments, tables are copied from tool results, and figures in the
answer that no tool returned are removed."""

import asyncio
import json
import logging
import re
import time

from app.modules.chatbot.llm import LLMClient, LLMRateLimited, LLMUnavailable
from app.modules.chatbot.mcp_client import McpTools
from app.modules.chatbot.tables import build_table

logger = logging.getLogger("app.chatbot")

MAX_TABLES = 3
MAX_TOOL_PAYLOAD = 12000
# Longest provider rate-limit wait absorbed inside one message before answering 429.
MAX_RATE_WAIT_SECONDS = 20
LANGUAGES = {
    "vi": "Vietnamese",
    "en": "English",
    "zh-CN": "Simplified Chinese",
    "zh-TW": "Traditional Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "th": "Thai",
    "id": "Indonesian",
    "ms": "Malay",
    "fil": "Filipino",
    "km": "Khmer",
    "lo": "Lao",
    "my": "Burmese",
    "hi": "Hindi",
    "bn": "Bengali",
    "ur": "Urdu",
    "ar": "Arabic",
    "tr": "Turkish",
    "ru": "Russian",
    "de": "German",
    "fr": "French",
    "es": "Spanish",
    "pt-BR": "Brazilian Portuguese",
    "it": "Italian",
}
FALLBACK = {
    "vi": "Đây là kết quả tra cứu.",
    "en": "Here are the results.",
}
NUMBER = re.compile(
    r"(?<![\w/-])\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d+)?(?![\w/-])"  # 1.250.000 / 1,250.5
    r"|(?<![\w/.,-])\d{4,}(?![\w/-])"  # 1250000
)


def without_nulls(value):
    """Tool data for the model without null fields (fewer tokens, same facts)."""
    if isinstance(value, dict):
        return {key: without_nulls(item) for key, item in value.items() if item is not None}
    if isinstance(value, list):
        return [without_nulls(item) for item in value]
    return value


def fallback(locale: str) -> str:
    return FALLBACK["vi" if locale.startswith("vi") else "en"]


def numbers_in(value) -> set[str]:
    """Digit strings of every number in a tool result or text (integer part only)."""
    found: set[str] = set()
    if isinstance(value, dict):
        for item in value.values():
            found |= numbers_in(item)
    elif isinstance(value, list):
        for item in value:
            found |= numbers_in(item)
    elif isinstance(value, bool) or value is None:
        pass
    elif isinstance(value, int | float):
        found.add(str(int(value)))
    elif isinstance(value, str):
        for token in re.findall(r"\d[\d.,]*", value):
            found.add(re.sub(r"\D", "", re.split(r"[.,](?=\d{1,2}$)", token)[0]))
            found.add(re.sub(r"\D", "", token.split(".")[0]))
    return found


def scrub_numbers(answer: str, allowed: set[str]) -> str:
    """Removes figures (4+ digits) that no tool returned and the user did not type."""

    def check(match: re.Match) -> str:
        token = match.group(0)
        digits = re.sub(r"\D", "", token)
        integer = re.sub(r"\D", "", re.split(r"[.,](?=\d{1,2}$)", token)[0])
        if len(digits) == 4 and 1900 <= int(digits) <= 2100:
            return token  # a year
        if digits in allowed or integer in allowed:
            return token
        return "…"

    return NUMBER.sub(check, answer)


def system_prompt(today: str, locale: str) -> str:
    language = LANGUAGES.get(locale, "English")
    return (
        "You are the read-only lookup assistant of Agentra, a dealer management system for "
        f"a goods distributor in Vietnam. Today is {today} (Asia/Ho_Chi_Minh). Always answer "
        f"in {language}, in one to three short plain-text sentences: no Markdown (no **, #, "
        "bullets or tables); the result table is shown to the user separately.\n"
        "Rules:\n"
        "- Use the tools for every figure; never invent, estimate or compute numbers.\n"
        "- To find an agency or product by name, call list_agencies / list_products with "
        "q=<name>. If several match, list their codes and ask which one; do not guess.\n"
        "- Report periods are half-open: fromDate inclusive, toDate exclusive. 'tháng "
        "10/2026' is 2026-10-01 to 2026-11-01; 'tháng này' is the first day of this month to "
        "the first day of next month. Ask for the period if a sales question has none.\n"
        "- You cannot create, edit, post, cancel or delete anything. If asked, say so and "
        "point to the business screens.\n"
        "- If a tool fails with 403, say the user lacks permission for that data. Do not "
        "reveal internal error codes or JSON."
    )


class Orchestrator:
    def __init__(self, client: LLMClient, max_steps: int, deadline_seconds: float):
        self.client = client
        self.max_steps = max_steps
        self.deadline_seconds = deadline_seconds

    async def run(self, tools: McpTools, turns: list[dict], today: str, locale: str) -> dict:
        definitions = await tools.openai_tools()
        messages = [{"role": "system", "content": system_prompt(today, locale)}, *turns]
        allowed: set[str] = set()
        for turn in turns:
            allowed |= numbers_in(turn["content"])
        tables: list[dict] = []
        called: list[str] = []
        model: str | None = None
        started = time.monotonic()
        for _ in range(self.max_steps):
            if time.monotonic() - started > self.deadline_seconds:
                break
            try:
                reply = await self._chat(messages, definitions, started)
            except LLMUnavailable:
                if tables:
                    break
                raise
            model = reply.model
            if not reply.tool_calls:
                answer = reply.content or fallback(locale)
                return self._reply(answer, tables, called, model, allowed)
            messages.append(
                {
                    "role": "assistant",
                    "content": reply.content or None,
                    "tool_calls": reply.tool_calls,
                }
            )
            for call in reply.tool_calls:
                name = call["function"]["name"]
                arguments = self._arguments(call["function"].get("arguments"))
                outcome = await tools.call(name, arguments)
                logger.info("chatbot tool %s ok=%s", name, outcome.ok)
                called.append(name)
                if outcome.ok:
                    allowed |= numbers_in(outcome.data)
                    table = build_table(name, outcome.data, locale)
                    if table is not None and len(tables) < MAX_TABLES:
                        tables.append(table)
                    content = json.dumps(
                        without_nulls(outcome.data),
                        ensure_ascii=False,
                        default=str,
                        separators=(",", ":"),
                    )
                else:
                    content = json.dumps({"error": outcome.data}, ensure_ascii=False)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.get("id") or name,
                        "content": content[:MAX_TOOL_PAYLOAD],
                    }
                )
        if tables:
            return self._reply(fallback(locale), tables, called, model, allowed)
        raise LLMUnavailable("tool loop exhausted")

    async def _chat(self, messages: list[dict], definitions: list[dict], started: float):
        """One model round; a short provider rate limit is waited out once."""
        try:
            return await self.client.chat(messages, definitions)
        except LLMRateLimited as error:
            remaining = self.deadline_seconds - (time.monotonic() - started)
            if error.retry_after > min(MAX_RATE_WAIT_SECONDS, remaining - 5):
                raise
            await asyncio.sleep(error.retry_after)
            return await self.client.chat(messages, definitions)

    @staticmethod
    def _arguments(raw) -> dict:
        if isinstance(raw, dict):
            return raw
        try:
            value = json.loads(raw or "{}")
        except (TypeError, ValueError):
            return {}
        return value if isinstance(value, dict) else {}

    @staticmethod
    def _reply(answer, tables, called, model, allowed) -> dict:
        return {
            "answer": scrub_numbers(answer, allowed)[:2000],
            "tables": tables,
            "tools": list(dict.fromkeys(called)),
            "model": model,
        }
