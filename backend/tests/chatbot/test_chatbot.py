"""Offline tests for the M32 web assistant: semantic engine, LLM client, tool loop,
service and HTTP route. No database and no real model are used."""

import json
from contextlib import contextmanager
from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.exceptions import ApiError, AuthError
from app.main import create_app
from app.modules.auth.permissions import FUNCTION_CODES
from app.modules.chatbot import dependencies as chatbot_dependencies
from app.modules.chatbot import orchestrator as orch
from app.modules.chatbot.engine import (
    SemanticQueryEngine,
    ToolError,
    code_key,
    decimal_text,
    match_entities,
    normalize,
)
from app.modules.chatbot.llm import LLMClient, LLMReply, LLMUnavailable
from app.modules.chatbot.schemas import ChatbotMessageRequest
from app.modules.chatbot.semantic_model import ADMISSION, PRODUCT_READERS, VARIANTS, variant_for
from app.modules.chatbot.service import ChatbotService

TODAY = date(2026, 11, 15)
NOW = datetime(2026, 11, 15, 3, 0, tzinfo=UTC)
EVERYTHING = frozenset(ADMISSION)


def settings(**overrides) -> Settings:
    values = {
        "_env_file": None,
        "db_host": "localhost",
        "db_user": "test",
        "db_password": "test",
        "auth_signing_key": "synthetic-test-key-32-bytes-or-more",
    }
    return Settings(**(values | overrides))


READY = {
    "chatbot_enabled": True,
    "chatbot_llm_base_url": "http://router.test/v1",
    "chatbot_llm_models": "model-a, model-b",
}


class FakeRepo:
    def __init__(self):
        self.reports: list[tuple] = []
        self.agency_rows = [
            agency(1, "DL-1", "Đại lý Hòa Bình", 1, 1, "1500000"),
            agency(2, "DL-2", "Tạp hóa Minh Phát", 2, 1, "250000"),
            agency(3, "DL-10", "Tạp hóa Minh Phát", 1, 2, "9000000"),
            agency(4, "DL-4", "Đại lý Cũ", 1, 1, "0", status="TERMINATED"),
        ]
        self.product_rows = [
            product(1, "MH-1", "Mì Hảo Hảo tôm chua cay", "Thùng", "137"),
            product(2, "MH-2", "Nước mắm Nam Ngư 500ml", "Chai", "4.5"),
            product(3, "MH-3", "Nước mắm", "Lít", "20"),
        ]

    def now(self):
        return NOW

    def agencies(self):
        return self.agency_rows

    def products(self):
        return self.product_rows

    def wards(self):
        return [
            {"id": 1, "code": "P1", "name": "Phường Sài Gòn"},
            {"id": 2, "code": "P2", "name": "Phường Bàn Cờ"},
            {"id": 3, "code": "P3", "name": "Phường Sài Gòn Mới"},
        ]

    def agency_types(self):
        return [
            {"id": 1, "code": "L1", "name": "Loại 1"},
            {"id": 2, "code": "L2", "name": "Loại 2"},
        ]

    def report(self, kind, from_date, to_date, filters):
        self.reports.append((kind, from_date, to_date, filters))
        if kind == "sales":
            rows = [
                {
                    "agencyCode": "DL-2",
                    "agencyName": "Tạp hóa Minh Phát",
                    "numberOfIssues": 2,
                    "salesAmount": Decimal("500000"),
                    "salesRate": None,
                },
                {
                    "agencyCode": "DL-1",
                    "agencyName": "Đại lý Hòa Bình",
                    "numberOfIssues": 3,
                    "salesAmount": Decimal("750000"),
                    "salesRate": Decimal("60"),
                },
            ]
        else:
            rows = []
        return {"rows": rows, "generatedAt": NOW}


def agency(id_, code, name, ward, type_, debt, status="ACTIVE"):
    return {
        "id": id_,
        "code": code,
        "name": name,
        "status": status,
        "typeId": type_,
        "wardId": ward,
        "debt": Decimal(debt),
        "wardName": {1: "Phường Sài Gòn", 2: "Phường Bàn Cờ"}[ward],
    }


def product(id_, code, name, unit, stock, status="ACTIVE"):
    return {
        "id": id_,
        "code": code,
        "name": name,
        "status": status,
        "stock": Decimal(stock),
        "unitName": unit,
    }


def make_engine(allowed=EVERYTHING, repo=None, locale="vi"):
    repo = repo or FakeRepo()

    @contextmanager
    def read():
        yield repo

    return SemanticQueryEngine(read, frozenset(allowed), TODAY, locale), repo


# -- semantic model and helpers -------------------------------------------------------
def test_semantic_model_permissions_are_registered_function_codes():
    assert set(ADMISSION) <= FUNCTION_CODES and set(PRODUCT_READERS) <= FUNCTION_CODES
    for variant in VARIANTS:
        assert set(variant.any_of) <= set(ADMISSION)
        assert variant.default_sort.removeprefix("-") in variant.sorts
    assert variant_for("SALES", True, None).key == "sales.agency"
    assert variant_for("SALES", True, "product").key == "sales.product"
    assert variant_for("DEBT", False, None).key == "debt.current"
    assert variant_for("INVENTORY", True, "product").key == "inventory.period"
    assert variant_for("DEBT", False, "product") is None
    assert variant_for("OTHER", False, None) is None


def test_text_helpers():
    assert normalize("  Đại  lý MINH Phát ") == "dai ly minh phat"
    assert code_key("DL-10") == ("DL", 10) and code_key("X") == ("X", 0)
    assert decimal_text(Decimal("1500000.00")) == "1500000"
    assert decimal_text("4.50") == "4.5"


def test_match_entities_code_words_duplicates_and_exact_names():
    repo = FakeRepo()
    assert [a["code"] for a in match_entities(repo.agency_rows, "dl 10", "agency")] == ["DL-10"]
    assert [a["code"] for a in match_entities(repo.agency_rows, "dl-1", "agency")] == ["DL-1"]
    duplicates = match_entities(repo.agency_rows, "minh phat", "agency")
    assert [a["code"] for a in duplicates] == ["DL-2", "DL-10"]
    assert match_entities(repo.agency_rows, "   ", "agency") == []
    # one exact product name wins over longer names containing it
    assert [p["code"] for p in match_entities(repo.product_rows, "nuoc mam", "product")] == ["MH-3"]
    assert len(match_entities(repo.product_rows, "mắm", "product")) == 2


# -- engine ----------------------------------------------------------------------------
def test_describe_lists_only_permitted_metrics():
    engine, _ = make_engine({"debt.read"})
    described = engine.describe()
    assert described["today"] == "2026-11-15" and set(described["metrics"]) == {"DEBT"}
    assert len(described["metrics"]["DEBT"]["shapes"]) == 2
    engine, _ = make_engine({"stock.issue.prepare"})
    assert set(engine.describe()["metrics"]) == {"INVENTORY"}


def test_find_checks_permission_and_projects_candidates():
    engine, _ = make_engine({"debt.read"})
    found = engine.find("agency", "Minh Phát")
    assert found == {
        "candidates": [
            {"code": "DL-2", "name": "Tạp hóa Minh Phát", "detail": "Phường Bàn Cờ"},
            {"code": "DL-10", "name": "Tạp hóa Minh Phát", "detail": "Phường Sài Gòn"},
        ],
        "totalMatches": 2,
    }
    with pytest.raises(ToolError) as error:
        engine.find("product", "mì")
    assert error.value.code == "FORBIDDEN_METRIC"
    engine, _ = make_engine({"stock.receipt.post"})
    assert engine.find("product", "mì")["candidates"][0]["detail"] == "Thùng"
    with pytest.raises(ToolError):
        engine.find("agency", "x")


def test_current_debt_sorted_filtered_and_truncated():
    engine, _ = make_engine()
    table = engine.query({"metric": "DEBT", "limit": 2})
    assert table["title"] == "Dư nợ hiện tại của đại lý"
    assert [row["agencyCode"] for row in table["rows"]] == ["DL-10", "DL-1"]
    assert table["rows"][0]["debt"] == "9000000"
    assert (table["totalRows"], table["truncated"]) == (3, True)  # terminated excluded
    assert table["source"] == {"operationId": "listAgencies", "query": {}}
    assert table["asOf"] == NOW.isoformat()
    table = engine.query(
        {
            "metric": "DEBT",
            "filters": [
                {"field": "debt", "op": "gte", "value": "1,000,000"},
                {"field": "ward", "op": "eq", "value": "p1"},
            ],
            "sort": "agencyCode",
        }
    )
    assert [row["agencyCode"] for row in table["rows"]] == ["DL-1", "DL-10"]
    assert table["understood"]["filters"] == [
        {"field": "debt", "op": "gte", "value": "1000000"},
        {"field": "ward", "op": "eq", "value": "P1"},
    ]
    assert table["source"]["query"] == {"wardId": "1"}


def test_current_inventory_and_selected_product():
    engine, _ = make_engine({"sales.read"}, locale="en")
    table = engine.query({"metric": "INVENTORY", "sort": "-stock"})
    assert table["title"] == "Current stock"
    assert [row["stock"] for row in table["rows"]] == ["137", "20", "4.5"]
    picked = engine.query(
        {"metric": "INVENTORY", "filters": [{"field": "product", "op": "eq", "value": "mắm"}]},
        select={"entity": "product", "code": "mh-2"},
    )
    assert [row["productCode"] for row in picked["rows"]] == ["MH-2"]
    assert picked["source"] == {"operationId": "listProducts", "query": {"productId": "2"}}


def test_period_sales_reads_report_with_resolved_filters():
    engine, repo = make_engine()
    table = engine.query(
        {
            "metric": "SALES",
            "period": {"fromDate": "2026-10-01", "toDate": "2026-11-01"},
            "filters": [{"field": "agencyType", "op": "eq", "value": "Loại 1"}],
            "limit": 5,
        }
    )
    assert repo.reports == [("sales", date(2026, 10, 1), date(2026, 11, 1), {"typeId": 1})]
    assert [row["agencyCode"] for row in table["rows"]] == ["DL-1", "DL-2"]
    assert table["rows"][0] == {
        "agencyCode": "DL-1",
        "agencyName": "Đại lý Hòa Bình",
        "numberOfIssues": 3,
        "salesAmount": "750000",
        "salesRate": "60",
    }
    assert table["rows"][1]["salesRate"] is None
    assert table["understood"]["groupBy"] == "agency"
    assert table["understood"]["period"] == {"fromDate": "2026-10-01", "toDate": "2026-11-01"}
    assert table["source"]["operationId"] == "getSalesReport"
    engine.query(
        {
            "metric": "INVENTORY",
            "period": {"fromDate": "2026-10-01", "toDate": "2026-11-01"},
            "filters": [{"field": "product", "op": "eq", "value": "MH-1"}],
        }
    )
    assert repo.reports[-1][0] == "inventory" and repo.reports[-1][3] == {"productId": 1}


@pytest.mark.parametrize(
    ("allowed", "query", "code"),
    [
        (EVERYTHING, [], "UNSUPPORTED_QUERY"),
        (EVERYTHING, {"metric": "PRICE"}, "UNSUPPORTED_QUERY"),
        (EVERYTHING, {"metric": "SALES"}, "MISSING_FIELD"),
        (EVERYTHING, {"metric": "SALES", "period": {"fromDate": "x"}}, "INVALID_VALUE"),
        (
            EVERYTHING,
            {"metric": "SALES", "period": {"fromDate": "2026-11-01", "toDate": "2026-11-01"}},
            "INVALID_VALUE",
        ),
        (EVERYTHING, {"metric": "DEBT", "groupBy": "product"}, "UNSUPPORTED_FIELD"),
        ({"sales.read"}, {"metric": "DEBT"}, "FORBIDDEN_METRIC"),
        (
            {"debt.read"},
            {"metric": "INVENTORY", "period": {"fromDate": "2026-10-01", "toDate": "2026-11-01"}},
            "FORBIDDEN_METRIC",
        ),
        (EVERYTHING, {"metric": "DEBT", "limit": 0}, "INVALID_VALUE"),
        (EVERYTHING, {"metric": "DEBT", "limit": True}, "INVALID_VALUE"),
        (EVERYTHING, {"metric": "DEBT", "sort": "name"}, "UNSUPPORTED_FIELD"),
        (EVERYTHING, {"metric": "DEBT", "filters": "x"}, "INVALID_VALUE"),
        (EVERYTHING, {"metric": "DEBT", "filters": ["x"]}, "INVALID_VALUE"),
        (EVERYTHING, {"metric": "DEBT", "filters": [{"field": "product"}]}, "UNSUPPORTED_FIELD"),
        (
            EVERYTHING,
            {"metric": "DEBT", "filters": [{"field": "agency", "op": "gt", "value": "x"}]},
            "INVALID_OPERATOR",
        ),
        (
            EVERYTHING,
            {"metric": "DEBT", "filters": [{"field": "agency", "op": "eq", "value": " "}]},
            "INVALID_VALUE",
        ),
        (
            EVERYTHING,
            {"metric": "DEBT", "filters": [{"field": "debt", "op": "gt", "value": "abc"}]},
            "INVALID_VALUE",
        ),
        (
            EVERYTHING,
            {"metric": "DEBT", "filters": [{"field": "debt", "op": "gt", "value": "NaN"}]},
            "INVALID_VALUE",
        ),
        (
            EVERYTHING,
            {"metric": "DEBT", "filters": [{"field": "agency", "op": "eq", "value": "Không"}]},
            "NO_MATCH",
        ),
        (
            EVERYTHING,
            {"metric": "DEBT", "filters": [{"field": "ward", "op": "eq", "value": "Sài Gòn"}]},
            "INVALID_VALUE",
        ),
    ],
)
def test_query_rejections(allowed, query, code):
    engine, _ = make_engine(allowed)
    with pytest.raises(ToolError) as error:
        engine.query(query)
    assert error.value.code == code
    assert error.value.payload()["error"] == code


def test_ambiguous_agency_carries_candidates():
    engine, _ = make_engine()
    with pytest.raises(ToolError) as error:
        engine.query(
            {"metric": "DEBT", "filters": [{"field": "agency", "op": "eq", "value": "Minh Phát"}]}
        )
    assert error.value.code == "AMBIGUOUS_ENTITY"
    assert error.value.details["entity"] == "agency"
    assert error.value.details["totalMatches"] == 2
    assert [c["code"] for c in error.value.details["candidates"]] == ["DL-2", "DL-10"]


# -- answer post-checks ----------------------------------------------------------------
def test_scrub_numbers_keeps_table_figures_years_and_dates():
    tables = [{"rows": [{"debt": "48181944", "rate": "15.5028", "code": None}]}]
    answer = "Nợ 48.181.944 VND (48181944), năm 2026, ngày 01/10/2026, sai 1.234.567 và 99999."
    assert orch.scrub_numbers(answer, tables) == (
        "Nợ 48.181.944 VND (48181944), năm 2026, ngày 01/10/2026, sai … và …."
    )
    assert orch.scrub_numbers("Tỷ lệ 15,5028 và 123", tables) == "Tỷ lệ 15,5028 và 123"


def test_pending_query_keeps_only_contract_shaped_parts():
    pending = orch.pending_query(
        {
            "metric": "SALES",
            "groupBy": "product",
            "period": {"fromDate": "2026-10-01", "toDate": "2026-11-01", "x": 1},
            "sort": "-salesAmount",
            "limit": 99,
            "filters": [
                {"field": "agency", "op": "eq", "value": "Minh Phát"},
                {"field": "product", "op": "eq", "value": 42},
                {"field": "bad field", "op": "eq", "value": "x"},
                {"field": "salesAmount", "op": "like", "value": "1"},
                {"field": "salesAmount", "op": "gt", "value": " "},
                "junk",
            ],
        },
        "agency",
    )
    assert pending == {
        "metric": "SALES",
        "filters": [{"field": "product", "op": "eq", "value": "42"}],
        "limit": 20,
        "groupBy": "product",
        "period": {"fromDate": "2026-10-01", "toDate": "2026-11-01"},
        "sort": "-salesAmount",
    }
    assert orch.pending_query({"metric": "DEBT", "sort": "x y"}, "agency") == {
        "metric": "DEBT",
        "filters": [],
        "limit": 20,
    }


def test_system_prompt_names_language_today_and_permitted_metrics():
    engine, _ = make_engine({"debt.read"})
    prompt = orch.system_prompt(engine, "ja")
    assert "Japanese" in prompt and "2026-11-15" in prompt and "DEBT" in prompt
    assert '"SALES"' not in prompt
    assert "English" in orch.system_prompt(engine, "xx")


# -- LLM client ------------------------------------------------------------------------
def completion(message: dict) -> dict:
    return {"choices": [{"message": message}]}


def test_llm_client_falls_back_across_models_and_parses_tool_calls():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        seen.append((body["model"], request.headers.get("authorization")))
        assert body["stream"] is False and body["tool_choice"] == "auto"
        if body["model"] == "a":
            return httpx.Response(400, json={"error": "nope"})
        if body["model"] == "b":
            raise httpx.ConnectError("down")
        if body["model"] == "c":
            return httpx.Response(200, text="not json")
        return httpx.Response(
            200,
            json=completion(
                {
                    "content": [{"type": "text", "text": "Xin "}, {"text": "chào"}, "x"],
                    "tool_calls": [
                        {"id": "1", "function": {"name": "query_metric", "arguments": "{}"}},
                        {"id": "2", "function": {"arguments": "{}"}},
                        "junk",
                    ],
                }
            ),
        )

    client = LLMClient(
        "http://router.test/v1/", "secret", ["a", "b", "c", "d"], 5, httpx.MockTransport(handler)
    )
    assert client.url == "http://router.test/v1/chat/completions"
    reply = client.chat([{"role": "user", "content": "hi"}], [])
    assert reply.model == "d" and reply.content == "Xin chào"
    assert [call["id"] for call in reply.tool_calls] == ["1"]
    assert [model for model, _ in seen] == ["a", "b", "c", "d"]
    assert seen[0][1] == "Bearer secret"


@pytest.mark.parametrize(
    "payload",
    [{"choices": []}, completion("text"), completion({"tool_calls": "x"}), {"x": 1}],
)
def test_llm_client_raises_when_every_model_fails(payload):
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
    client = LLMClient("http://router.test/v1", "", ["only"], 5, transport)
    assert "authorization" not in {key.lower() for key in client.headers}
    with pytest.raises(LLMUnavailable):
        client.chat([], [])
    with pytest.raises(LLMUnavailable, match="no model"):
        LLMClient("http://router.test/v1", "", [], 5, transport).chat([], [])


# -- orchestrator ----------------------------------------------------------------------
class ScriptedClient:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls: list[list[dict]] = []

    def chat(self, messages, tools):
        self.calls.append(list(messages))
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


def call(name, arguments=None, raw=None, id_="c1"):
    text = raw if raw is not None else json.dumps(arguments or {})
    return {"id": id_, "type": "function", "function": {"name": name, "arguments": text}}


def tools(*calls, content=""):
    return LLMReply(model="m1", content=content, tool_calls=list(calls))


def say(content):
    return LLMReply(model="m1", content=content, tool_calls=[])


def run(client, allowed=EVERYTHING, locale="vi", steps=4, deadline=45):
    engine, _ = make_engine(allowed)
    turns = [{"role": "user", "content": "câu hỏi"}]
    return orch.Orchestrator(client, steps, deadline).run(engine, turns, locale)


def test_orchestrator_answers_from_tool_tables():
    client = ScriptedClient(
        tools(call("query_metric", {"metric": "DEBT", "limit": 1})),
        say("Đại lý DL-10 nợ 9.000.000 đồng, không phải 123.456.789."),
    )
    reply = run(client)
    assert reply["status"] == "ANSWERED" and reply["model"] == "m1"
    assert reply["answer"] == "Đại lý DL-10 nợ 9.000.000 đồng, không phải …."
    assert reply["tables"][0]["rows"][0]["agencyCode"] == "DL-10"
    tool_message = client.calls[1][-1]
    assert tool_message["role"] == "tool" and tool_message["tool_call_id"] == "c1"
    assert client.calls[1][-2]["tool_calls"][0]["function"]["name"] == "query_metric"


def test_orchestrator_feeds_tool_errors_back_and_other_tools():
    client = ScriptedClient(
        tools(
            call("describe_semantic_model"),
            call("find_agencies", {"query": "Hòa Bình"}, id_="c2"),
            call("find_products", {"query": "mì"}, id_="c3"),
            call("query_metric", raw="{not json", id_="c4"),
            call("unknown_tool", raw="[1]", id_="c5"),
        ),
        say(""),
    )
    reply = run(client)
    assert reply == {"status": "NEEDS_INFO", "answer": orch.TEMPLATES["missing"]["vi"],
                     "missing": ["metric"]}  # fmt: skip
    results = [json.loads(m["content"]) for m in client.calls[1] if m["role"] == "tool"]
    assert "metrics" in results[0] and results[1]["totalMatches"] == 1
    assert results[2]["candidates"][0]["code"] == "MH-1"
    assert results[3]["error"] == "UNSUPPORTED_QUERY"
    assert results[4]["error"] == "UNSUPPORTED_QUERY"


@pytest.mark.parametrize(
    ("query", "status", "extra"),
    [
        (
            {"metric": "DEBT", "filters": [{"field": "agency", "op": "eq", "value": "Không"}]},
            "REFUSED",
            {"reason": "NO_MATCH"},
        ),
        ({"metric": "SALES"}, "NEEDS_INFO", {"missing": ["period"]}),
    ],
)
def test_orchestrator_maps_last_tool_error(query, status, extra):
    reply = run(ScriptedClient(tools(call("query_metric", query)), say("")))
    assert reply["status"] == status and reply["answer"]
    assert {key: reply[key] for key in extra} == extra


def test_orchestrator_forbidden_metric_and_missing_detail_default():
    reply = run(
        ScriptedClient(tools(call("query_metric", {"metric": "DEBT"})), say("Không có quyền.")),
        allowed={"sales.read"},
    )
    assert reply == {"status": "REFUSED", "answer": "Không có quyền.", "reason": "FORBIDDEN_METRIC"}
    final = orch.Orchestrator(None, 1, 1)._final("", [], ToolError("MISSING_FIELD", "x"), "m", "en")
    assert final == {"status": "NEEDS_INFO", "answer": "Could you add a bit more detail?",
                     "missing": ["period"]}  # fmt: skip


def test_orchestrator_selection_on_ambiguous_entity():
    query = {
        "metric": "DEBT",
        "filters": [{"field": "agency", "op": "eq", "value": "Minh Phát"}],
        "limit": 5,
    }
    reply = run(ScriptedClient(tools(call("query_metric", query))), locale="en")
    assert reply["status"] == "NEEDS_SELECTION" and reply["entity"] == "agency"
    assert reply["answer"] == "2 agency records match. Please pick the right code."
    assert reply["pendingQuery"] == {"metric": "DEBT", "filters": [], "limit": 5}
    assert reply["totalMatches"] == 2 and len(reply["candidates"]) == 2


def test_orchestrator_ask_user_and_unsupported():
    reply = run(
        ScriptedClient(
            tools(call("ask_user", {"question": " Kỳ nào? ", "missing": ["period", "x"]}))
        )
    )  # noqa: E501
    assert reply == {"status": "NEEDS_INFO", "answer": "Kỳ nào?", "missing": ["period"]}
    reply = run(ScriptedClient(tools(call("ask_user", {"missing": "period"}), content="Hỏi?")))
    assert reply == {"status": "NEEDS_INFO", "answer": "Hỏi?", "missing": ["metric"]}
    reply = run(ScriptedClient(tools(call("ask_user"))), locale="en")
    assert reply["answer"] == "Could you add a bit more detail?"
    reply = run(ScriptedClient(tools(call("report_unsupported"))), locale="en")
    assert reply["status"] == "REFUSED" and reply["reason"] == "UNSUPPORTED_QUERY"
    assert reply["answer"].startswith("I can only look up")
    reply = run(ScriptedClient(say("Xin chào! Mình tra cứu được công nợ.")))
    assert reply["status"] == "NEEDS_INFO" and reply["missing"] == ["metric"]


def test_orchestrator_unavailable_exhausted_and_deadline():
    with pytest.raises(LLMUnavailable):
        run(ScriptedClient(LLMUnavailable("down")))
    query = call("query_metric", {"metric": "DEBT"})
    reply = run(ScriptedClient(tools(query), LLMUnavailable("down")))
    assert reply["status"] == "ANSWERED" and reply["answer"] == "Đây là kết quả tra cứu."
    reply = run(ScriptedClient(tools(query), tools(query)), steps=2, locale="en")
    assert reply["answer"] == "Here are the results."
    with pytest.raises(LLMUnavailable, match="exhausted"):
        run(ScriptedClient(tools(call("describe_semantic_model"))), steps=1)
    with pytest.raises(LLMUnavailable):
        run(ScriptedClient(), deadline=-1)


def test_orchestrator_keeps_at_most_three_tables():
    query = call("query_metric", {"metric": "DEBT"})
    reply = run(ScriptedClient(tools(query, query, query, query), say("Xong.")))
    assert len(reply["tables"]) == 3


# -- service ---------------------------------------------------------------------------
def request(**values) -> ChatbotMessageRequest:
    body = {"messages": [{"role": "user", "content": "Ai nợ nhiều nhất?"}]} | values
    return ChatbotMessageRequest.model_validate(body)


def service(client=None, allowed=EVERYTHING, limiter=None, **overrides):
    repo = FakeRepo()
    chatbot = ChatbotService(Mock(), settings(**(READY | overrides)), Mock(), limiter=limiter,
                             client=client)  # fmt: skip
    chatbot._admit = lambda token: (7, frozenset(allowed), TODAY)

    @contextmanager
    def repository():
        yield repo

    chatbot._repository = repository
    return chatbot


def test_settings_parse_models_and_readiness():
    assert settings(**READY).chatbot_models() == ["model-a", "model-b"]
    assert settings(**READY).chatbot_ready()
    assert not settings().chatbot_ready()
    assert not settings(**(READY | {"chatbot_llm_models": " , "})).chatbot_ready()
    assert not settings(**(READY | {"chatbot_enabled": False})).chatbot_ready()


def test_service_unavailable_validation_and_limiter():
    with pytest.raises(ApiError) as error:
        service(chatbot_enabled=False).send("t", request())
    assert (error.value.status, error.value.code) == (503, "CHATBOT_UNAVAILABLE")
    limiter = Mock()
    turns = [{"role": "user", "content": "a"}, {"role": "assistant", "content": "b"}]
    with pytest.raises(ApiError) as error:
        service(limiter=limiter).send("t", request(messages=turns))
    assert error.value.status == 422
    limiter.assert_called_once_with(7)


def test_service_runs_tool_loop_and_maps_llm_failure():
    client = ScriptedClient(tools(call("query_metric", {"metric": "DEBT", "limit": 1})), say("Ok"))
    reply = service(client).send("t", request())
    dumped = reply.model_dump(mode="json", exclude_none=True)
    assert dumped["status"] == "ANSWERED" and dumped["tables"][0]["totalRows"] == 3
    with pytest.raises(ApiError) as error:
        service(ScriptedClient(LLMUnavailable("down"))).send("t", request())
    assert error.value.code == "CHATBOT_UNAVAILABLE"


def test_service_builds_client_from_settings():
    chatbot = ChatbotService(Mock(), settings(**READY, chatbot_llm_api_key="k"), Mock())
    client = chatbot._client()
    assert client.models == ["model-a", "model-b"] and client.headers["Authorization"] == "Bearer k"


def resume(query, entity="agency", code="DL-10"):
    return {"query": query, "select": {"entity": entity, "code": code}}


def test_service_resume_runs_without_llm():
    chatbot = service(client=ScriptedClient())
    reply = chatbot.send("t", request(resume=resume({"metric": "DEBT", "filters": []})))
    dumped = reply.model_dump(mode="json", exclude_none=True)
    assert dumped["status"] == "ANSWERED" and "model" not in dumped
    assert dumped["answer"] == "Đây là kết quả cho DL-10."
    assert [row["agencyCode"] for row in dumped["tables"][0]["rows"]] == ["DL-10"]


def test_service_resume_other_outcomes():
    sales = {
        "metric": "SALES",
        "groupBy": "product",
        "period": {"fromDate": "2026-10-01", "toDate": "2026-11-01"},
        "filters": [{"field": "product", "op": "eq", "value": "mắm"}],
    }
    reply = service().send("t", request(resume=resume(sales)))
    assert reply.status == "NEEDS_SELECTION" and reply.entity == "product"
    assert reply.pendingQuery.model_dump(exclude_none=True)["filters"] == [
        {"field": "agency", "op": "eq", "value": "DL-10"}
    ]
    reply = service().send("t", request(resume=resume({"metric": "DEBT", "filters": []}, code="X")))
    assert (reply.status, reply.reason) == ("REFUSED", "NO_MATCH")
    reply = service(allowed={"sales.read"}).send(
        "t", request(resume=resume({"metric": "DEBT", "filters": []}))
    )
    assert reply.reason == "FORBIDDEN_METRIC"
    reply = service().send("t", request(resume=resume({"metric": "SALES", "filters": []})))
    assert (reply.status, reply.missing) == ("NEEDS_INFO", ["period"])
    with pytest.raises(ApiError) as error:
        service().send(
            "t", request(resume=resume({"metric": "DEBT", "filters": []}, entity="product"))
        )
    assert error.value.status == 422


def test_service_admit_rejects_bad_token_before_database():
    engine = Mock()
    chatbot = ChatbotService(engine, settings(**READY), Mock())
    with pytest.raises(AuthError) as error:
        chatbot.send("not-a-jwt", request())
    assert error.value.status == 401
    engine.connect.assert_not_called()


def test_service_admit_checks_permissions(monkeypatch):
    from app.modules.chatbot import service as module

    session = Mock()
    session.execute.return_value.scalar_one.return_value = TODAY
    chatbot = ChatbotService(Mock(), settings(**READY), Mock())

    @contextmanager
    def read():
        yield session

    chatbot._read = read
    monkeypatch.setattr(module, "decode_access_token", lambda *args: None)
    granted = {"value": ["debt.read", "agency.read"]}

    class FakeAuth:
        def __init__(self, *args, **kwargs):
            pass

        def authenticate(self, token):
            return SimpleNamespace(user_id=9)

        def get_current_user(self, principal):
            return SimpleNamespace(allowedFunctions=granted["value"])

    monkeypatch.setattr(module, "AuthService", FakeAuth)
    assert chatbot._admit("t") == (9, frozenset({"debt.read", "agency.read"}), TODAY)
    granted["value"] = ["agency.read"]
    with pytest.raises(AuthError) as error:
        chatbot._admit("t")
    assert error.value.status == 403


def test_service_read_uses_read_only_repeatable_read_transaction():
    connection = Mock()
    engine = Mock()
    engine.connect.return_value.__enter__ = Mock(return_value=connection)
    engine.connect.return_value.__exit__ = Mock(return_value=False)
    configured = connection.execution_options.return_value
    configured.begin.return_value.__enter__ = Mock()
    configured.begin.return_value.__exit__ = Mock(return_value=False)
    chatbot = ChatbotService(engine, settings(**READY), Mock())
    with chatbot._repository() as repo:
        assert repo.session.bind is configured
    connection.execution_options.assert_called_once_with(
        isolation_level="REPEATABLE READ", postgresql_readonly=True
    )


# -- dependencies and HTTP route -------------------------------------------------------
def test_chatbot_limiter_uses_its_own_bucket_and_maps_retry_after():
    limiter = Mock()
    app_state = SimpleNamespace(settings=settings(chatbot_rate_limit=3), auth_limiter=limiter)
    http = SimpleNamespace(app=SimpleNamespace(state=app_state), client=None)
    chatbot_dependencies.chatbot_limiter(http)(5)
    key, limit, window = limiter.check.call_args.args
    assert (limit, window) == (3, 60) and isinstance(key, str)
    limiter.check.side_effect = AuthError(429, "RATE_LIMITED", "Slow down", retry_after=7)
    with pytest.raises(ApiError) as error:
        chatbot_dependencies.chatbot_limiter(http)(5)
    assert error.value.status == 429 and error.value.headers == {"Retry-After": "7"}


class FakeService:
    def __init__(self):
        self.tokens = []

    def send(self, token, body):
        self.tokens.append(token)
        return {"status": "NEEDS_INFO", "answer": "Kỳ nào?", "missing": ["period"]}


@pytest.fixture
def http():
    app = create_app(settings(**READY))
    fake = FakeService()
    app.dependency_overrides[chatbot_dependencies.get_chatbot_service] = lambda: fake
    with TestClient(app) as client:
        yield client, fake


def test_route_contract_headers_and_errors(http):
    client, fake = http
    body = {"messages": [{"role": "user", "content": "Doanh số?"}]}
    url = "/api/v1/chatbot/messages"
    response = client.post(url, json=body, headers={"Authorization": "Bearer abc"})
    assert response.status_code == 200 and response.headers["Cache-Control"] == "no-store"
    assert response.json() == {"status": "NEEDS_INFO", "answer": "Kỳ nào?", "missing": ["period"]}
    assert fake.tokens == ["abc"]
    assert client.post(url, json=body).status_code == 401
    response = client.post(
        url, content="x", headers={"Authorization": "Bearer abc", "Content-Type": "text/plain"}
    )
    assert response.status_code == 415
    bad = {"messages": [], "locale": "vi"}
    response = client.post(url, json=bad, headers={"Authorization": "Bearer abc"})
    assert response.status_code == 422
    spec = client.get("/api/openapi.json").json()["paths"]["/api/v1/chatbot/messages"]["post"]
    assert spec["operationId"] == "sendChatbotMessage"
    assert spec["x-permissions"] == {"anyOf": list(ADMISSION)}
    assert {"200", "401", "403", "415", "422", "429", "503"} <= set(spec["responses"])


def test_dependency_factory_builds_service():
    state = SimpleNamespace(engine=Mock(), settings=settings(), reset_delivery=Mock())
    built = chatbot_dependencies.get_chatbot_service(
        SimpleNamespace(app=SimpleNamespace(state=state))
    )
    assert isinstance(built, ChatbotService) and built.limiter is not None


def test_orchestrator_accepts_object_arguments():
    raw = {"id": "c1", "function": {"name": "query_metric", "arguments": {"metric": "DEBT"}}}
    reply = run(ScriptedClient(tools(raw), say("Ok")))
    assert reply["status"] == "ANSWERED"


def test_repository_reads_through_the_session():
    from app.modules.chatbot import repository as module

    session = Mock()
    session.execute.return_value.mappings.return_value = [{"id": 1, "code": "X"}]
    session.execute.return_value.scalar_one.return_value = NOW
    repo = module.ChatbotRepository(session)
    assert repo.now() == NOW
    for reader in (repo.agencies, repo.products, repo.wards, repo.agency_types):
        assert reader() == [{"id": 1, "code": "X"}]
    sql = " ".join(str(c.args[0]) for c in session.execute.call_args_list)
    assert "dms.agency a" in sql and "dms.product p" in sql and "dms.ward" in sql
    queries = Mock()
    queries.return_value.read.return_value = {"rows": [], "generatedAt": NOW}
    original = module.ReportQueries
    module.ReportQueries = queries
    try:
        assert repo.report("debt", TODAY, TODAY, {}) == {"rows": [], "generatedAt": NOW}
    finally:
        module.ReportQueries = original
    queries.return_value.read.assert_called_once_with("debt", TODAY, TODAY, {})
