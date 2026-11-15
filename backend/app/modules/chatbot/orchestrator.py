"""Web-assistant tool loop: the LLM only chooses tools and arguments; figures always
come from SemanticQueryEngine results (CONTRACT.md -> Safety rules)."""

import json
import logging
import re
import time

from app.modules.chatbot.engine import SemanticQueryEngine, ToolError, iterate_numbers
from app.modules.chatbot.llm import LLMClient, LLMUnavailable

logger = logging.getLogger("app.chatbot")

MAX_TABLES = 3
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

QUERY_SCHEMA = {
    "type": "object",
    "properties": {
        "metric": {"type": "string", "enum": ["DEBT", "INVENTORY", "SALES"]},
        "groupBy": {"type": "string", "enum": ["agency", "product"]},
        "period": {
            "type": "object",
            "description": "Half-open business-date interval [fromDate, toDate).",
            "properties": {
                "fromDate": {"type": "string", "description": "YYYY-MM-DD, inclusive"},
                "toDate": {"type": "string", "description": "YYYY-MM-DD, exclusive"},
            },
            "required": ["fromDate", "toDate"],
        },
        "filters": {
            "type": "array",
            "maxItems": 5,
            "items": {
                "type": "object",
                "properties": {
                    "field": {"type": "string"},
                    "op": {"type": "string", "enum": ["eq", "gt", "gte", "lt", "lte"]},
                    "value": {"type": "string"},
                },
                "required": ["field", "op", "value"],
            },
        },
        "sort": {"type": "string", "description": "Allowed sort field, '-' for descending"},
        "limit": {"type": "integer", "minimum": 1, "maximum": 50},
    },
    "required": ["metric"],
}


def function(name: str, description: str, parameters: dict) -> dict:
    return {
        "type": "function",
        "function": {"name": name, "description": description, "parameters": parameters},
    }


TOOLS = [
    function(
        "query_metric",
        "Read exact DEBT, INVENTORY or SALES figures. Pass agency/product names or codes as "
        "filter values exactly as the user wrote them; the system resolves them.",
        QUERY_SCHEMA,
    ),
    function(
        "find_agencies",
        "Find agencies by name or code (code, name, ward only; no balances).",
        {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
    ),
    function(
        "find_products",
        "Find products by name or code (code, name, unit only).",
        {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
    ),
    function(
        "describe_semantic_model",
        "List the metrics, filters and sorts this user may query.",
        {"type": "object", "properties": {}},
    ),
    function(
        "ask_user",
        "Ask the user for missing information instead of guessing (for example the period "
        "of a SALES question, or which metric they mean).",
        {
            "type": "object",
            "properties": {
                "question": {"type": "string", "description": "Short question to the user"},
                "missing": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["metric", "period", "agency", "product"]},
                },
            },
            "required": ["question", "missing"],
        },
    ),
    function(
        "report_unsupported",
        "Call when the request is NOT a lookup of debt, inventory or sales (for example "
        "creating, editing or deleting documents, changing prices, or unrelated topics).",
        {"type": "object", "properties": {}},
    ),
]

TEMPLATES = {
    "selection": {
        "vi": "Có {total} {entity} khớp với yêu cầu. Bạn chọn đúng mã cần tra cứu nhé.",
        "en": "{total} {entity} records match. Please pick the right code.",
    },
    "entity": {
        "vi": {"agency": "đại lý", "product": "mặt hàng"},
        "en": {"agency": "agency", "product": "product"},
    },
    "resumed": {
        "vi": "Đây là kết quả cho {code}.",
        "en": "Here are the results for {code}.",
    },
    "answered": {
        "vi": "Đây là kết quả tra cứu.",
        "en": "Here are the results.",
    },
    "unsupported": {
        "vi": "Mình chỉ tra cứu được công nợ, tồn kho và doanh số; mọi thay đổi dữ liệu "
        "bạn thực hiện trên màn hình nghiệp vụ nhé.",
        "en": "I can only look up debt, inventory and sales; make any data changes on the "
        "business screens.",
    },
    "missing": {
        "vi": "Bạn bổ sung thêm thông tin giúp mình nhé.",
        "en": "Could you add a bit more detail?",
    },
}

NUMBER = re.compile(
    r"(?<![\w/-])\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d+)?(?![\w/-])|(?<![\w/.,-])\d{4,}(?![\w/-])"
)


def template(key: str, locale: str, **values) -> str:
    texts = TEMPLATES[key]
    text = texts["vi"] if locale.startswith("vi") else texts["en"]
    return text.format(**values)


def scrub_numbers(answer: str, tables: list[dict]) -> str:
    """Removes figures (4+ digits) that are not present in the tool results."""
    allowed = {re.sub(r"\D", "", value.split(".")[0]) for value in iterate_numbers(tables)}

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


def pending_query(arguments: dict, entity: str) -> dict:
    """The engine already validated metric/period/sort/limit before resolving entities;
    keep only contract-shaped filters and drop the one the user is about to pick."""
    filters = []
    for item in arguments.get("filters") or []:
        if not isinstance(item, dict) or item.get("field") == entity:
            continue
        field, op, value = item.get("field"), item.get("op"), item.get("value")
        if not (isinstance(field, str) and re.fullmatch(r"[A-Za-z]+", field)):
            continue
        if op not in {"eq", "gt", "gte", "lt", "lte"} or not isinstance(value, str | int | float):
            continue
        text = str(value).strip()[:120]
        if text:
            filters.append({"field": field, "op": op, "value": text})
    limit = arguments.get("limit", 20)
    pending = {
        "metric": arguments.get("metric"),
        "filters": filters[:5],
        "limit": limit if type(limit) is int and 1 <= limit <= 50 else 20,
    }
    if arguments.get("groupBy") in {"agency", "product"}:
        pending["groupBy"] = arguments["groupBy"]
    period = arguments.get("period")
    if isinstance(period, dict) and period.get("fromDate") and period.get("toDate"):
        pending["period"] = {"fromDate": period["fromDate"], "toDate": period["toDate"]}
    sort = arguments.get("sort")
    if isinstance(sort, str) and re.fullmatch(r"-?[A-Za-z]+", sort):
        pending["sort"] = sort
    return pending


def system_prompt(engine: SemanticQueryEngine, locale: str) -> str:
    language = LANGUAGES.get(locale, "English")
    model = json.dumps(engine.describe(), ensure_ascii=False)
    return (
        "You are the read-only lookup assistant of Agentra, a dealer management system "
        f"for a goods distributor in Vietnam. Today is {engine.today.isoformat()} "
        "(Asia/Ho_Chi_Minh). "
        f"Always answer in {language}, in one or two short plain sentences without "
        "markdown tables; the result table is shown to the user separately.\n"
        "Rules:\n"
        "- You can only look up DEBT (agency debt), INVENTORY (product stock) and SALES "
        "(sales of posted stock issues). Use query_metric for every figure; never invent, "
        "estimate or compute numbers yourself.\n"
        "- Periods are half-open [fromDate, toDate). 'tháng 10/2026' is 2026-10-01 to "
        "2026-11-01; 'tháng này' is the first day of this month to the first day of next "
        "month; 'hôm nay' is today to tomorrow.\n"
        "- SALES needs a period. If the user gives none, ask which period instead of "
        "guessing. DEBT/INVENTORY without a period means the current balance.\n"
        "- Put agency or product names/codes into filters exactly as written "
        "(field 'agency' or 'product', op 'eq').\n"
        "- If information is missing, call ask_user with a short question and the missing "
        "fields. For a greeting or a vague message, call ask_user with missing ['metric'] "
        "and say briefly what you can look up.\n"
        "- If the user asks to create, edit, cancel or delete data, or about an unrelated "
        "topic, call report_unsupported.\n"
        "- If a tool returns an error, fix the arguments or call ask_user; do not reveal "
        "internal error codes.\n"
        f"Metrics available to this user: {model}"
    )


class Orchestrator:
    def __init__(self, client: LLMClient, max_steps: int, deadline_seconds: float):
        self.client = client
        self.max_steps = max_steps
        self.deadline_seconds = deadline_seconds

    def run(self, engine: SemanticQueryEngine, turns: list[dict], locale: str) -> dict:
        messages = [{"role": "system", "content": system_prompt(engine, locale)}, *turns]
        tables: list[dict] = []
        last_error: ToolError | None = None
        model: str | None = None
        started = time.monotonic()
        for _ in range(self.max_steps):
            if time.monotonic() - started > self.deadline_seconds:
                break
            try:
                reply = self.client.chat(messages, TOOLS)
            except LLMUnavailable:
                if tables:
                    break
                raise
            model = reply.model
            if not reply.tool_calls:
                return self._final(reply.content, tables, last_error, model, locale)
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
                if name == "ask_user":
                    return ask_reply(arguments, reply.content, locale)
                if name == "report_unsupported":
                    return {
                        "status": "REFUSED",
                        "answer": reply.content or template("unsupported", locale),
                        "reason": "UNSUPPORTED_QUERY",
                    }
                try:
                    result = self._execute(engine, name, arguments)
                except ToolError as error:
                    logger.info("chatbot tool %s -> %s", name, error.code)
                    if error.code == "AMBIGUOUS_ENTITY":
                        return selection_reply(error, arguments, locale)
                    last_error = error
                    content = error.payload()
                else:
                    logger.info("chatbot tool %s ok", name)
                    if name == "query_metric" and len(tables) < MAX_TABLES:
                        tables.append(result)
                        last_error = None
                    content = result
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.get("id") or name,
                        "content": json.dumps(content, ensure_ascii=False, default=str),
                    }
                )
        if tables:
            return self._answered(template("answered", locale), tables, model)
        raise LLMUnavailable("tool loop exhausted")

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
    def _execute(engine: SemanticQueryEngine, name: str, arguments: dict) -> dict:
        if name == "query_metric":
            return engine.query(arguments)
        if name == "find_agencies":
            return engine.find("agency", str(arguments.get("query", "")))
        if name == "find_products":
            return engine.find("product", str(arguments.get("query", "")))
        if name == "describe_semantic_model":
            return engine.describe()
        raise ToolError("UNSUPPORTED_QUERY", f"Unknown tool {name!r}")

    def _final(self, content, tables, last_error, model, locale) -> dict:
        if tables:
            return self._answered(content or template("answered", locale), tables, model)
        if last_error is not None and last_error.code == "FORBIDDEN_METRIC":
            return {
                "status": "REFUSED",
                "answer": content or last_error.message,
                "reason": "FORBIDDEN_METRIC",
            }
        if last_error is not None and last_error.code == "NO_MATCH":
            return {
                "status": "REFUSED",
                "answer": content or last_error.message,
                "reason": "NO_MATCH",
            }
        missing = ["metric"]
        if last_error is not None and last_error.code == "MISSING_FIELD":
            missing = list(last_error.details.get("missing") or ["period"])
        return {
            "status": "NEEDS_INFO",
            "answer": content or template("missing", locale),
            "missing": missing,
        }

    @staticmethod
    def _answered(content: str, tables: list[dict], model: str | None) -> dict:
        return {
            "status": "ANSWERED",
            "answer": scrub_numbers(content, tables)[:2000],
            "tables": tables,
            "model": model,
        }


def selection_reply(error: ToolError, arguments: dict, locale: str) -> dict:
    entity = error.details["entity"]
    pending = pending_query(arguments, entity)
    names = TEMPLATES["entity"]["vi" if locale.startswith("vi") else "en"]
    return {
        "status": "NEEDS_SELECTION",
        "answer": template(
            "selection", locale, total=error.details["totalMatches"], entity=names[entity]
        ),
        "entity": entity,
        "candidates": error.details["candidates"],
        "totalMatches": error.details["totalMatches"],
        "pendingQuery": pending,
    }


def ask_reply(arguments: dict, content: str, locale: str) -> dict:
    allowed = ("metric", "period", "agency", "product")
    raw = arguments.get("missing")
    missing = [item for item in allowed if isinstance(raw, list) and item in raw] or ["metric"]
    question = arguments.get("question")
    answer = question.strip() if isinstance(question, str) and question.strip() else content
    return {
        "status": "NEEDS_INFO",
        "answer": (answer or template("missing", locale))[:2000],
        "missing": missing,
    }
