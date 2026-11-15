"""Offline tests for the M32 web assistant: LLM client, MCP client wrapper, tables,
tool loop, service and HTTP route. No database, MCP server or real model is used."""

import asyncio
import json
from contextlib import asynccontextmanager, contextmanager
from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import pytest
from fastapi.testclient import TestClient
from fastmcp.exceptions import ToolError

from app.core.config import Settings
from app.core.exceptions import ApiError, AuthError
from app.main import create_app
from app.modules.chatbot import dependencies as chatbot_dependencies
from app.modules.chatbot import mcp_client
from app.modules.chatbot import orchestrator as orch
from app.modules.chatbot.llm import LLMClient, LLMReply, LLMUnavailable
from app.modules.chatbot.mcp_client import McpTools, McpUnavailable, ToolOutcome
from app.modules.chatbot.schemas import ChatbotMessageRequest
from app.modules.chatbot.service import ChatbotService
from app.modules.chatbot.tables import TABLES, build_table, cell

READY = {
    "chatbot_enabled": True,
    "chatbot_llm_base_url": "http://router.test/v1",
    "chatbot_llm_models": "model-a, model-b",
    "chatbot_mcp_url": "http://mcp.test/mcp",
}
AGENCIES = {
    "items": [
        {
            "id": "8",
            "code": "DL-8",
            "name": "Tạp hóa Minh Phát",
            "wardName": "Phường Gò Vấp",
            "typeName": "Loại 2",
            "debt": "2743800",
            "maxDebt": "20000000.00",
            "phone": "0904017747",
        },
        {"id": "23", "code": "DL-23", "name": "Tạp hóa Minh Phát", "debt": "3696480"},
    ],
    "pagination": {"limit": 25, "nextCursor": None, "hasMore": False},
}


def settings(**overrides) -> Settings:
    values = {
        "_env_file": None,
        "db_host": "localhost",
        "db_user": "test",
        "db_password": "test",
        "auth_signing_key": "synthetic-test-key-32-bytes-or-more",
    }
    return Settings(**(values | overrides))


def run(coro):
    return asyncio.run(coro)


# -- settings ----------------------------------------------------------------------
def test_settings_parse_models_and_readiness():
    assert settings(**READY).chatbot_models() == ["model-a", "model-b"]
    assert settings(**READY).chatbot_ready()
    assert not settings().chatbot_ready()
    assert not settings(**(READY | {"chatbot_llm_models": " , "})).chatbot_ready()
    assert not settings(**(READY | {"chatbot_mcp_url": ""})).chatbot_ready()
    assert not settings(**(READY | {"chatbot_enabled": False})).chatbot_ready()


# -- tables ------------------------------------------------------------------------
def test_cell_types():
    assert cell(None, "money") is None
    assert cell("20000000.00", "money") == "20000000"
    assert cell("4.50", "quantity") == "4.5"
    assert cell("abc", "money") is None
    assert cell("NaN", "rate") is None
    assert cell("12", "integer") == 12 and cell("x", "integer") is None
    assert cell("POSTED", "status") == "POSTED"
    assert len(cell("x" * 500, "text")) == 400


def test_build_table_projects_fixed_columns_without_contact_data():
    table = build_table("list_agencies", AGENCIES, "vi")
    assert table["title"] == "Đại lý" and table["tool"] == "list_agencies"
    assert [c["key"] for c in table["columns"]] == [
        "agencyCode",
        "agencyName",
        "wardName",
        "typeName",
        "debt",
        "maxDebt",
    ]
    assert table["rows"][0] == {
        "agencyCode": "DL-8",
        "agencyName": "Tạp hóa Minh Phát",
        "wardName": "Phường Gò Vấp",
        "typeName": "Loại 2",
        "debt": "2743800",
        "maxDebt": "20000000",
    }
    assert table["rows"][1]["wardName"] is None
    assert (table["totalRows"], table["truncated"]) == (2, False)
    assert "phone" not in json.dumps(table)


def test_build_table_reports_truncation_and_generated_time():
    rows = [{"agencyCode": f"DL-{i}", "salesAmount": "1"} for i in range(60)]
    data = {"items": rows, "generatedAt": "2026-11-15T02:00:00Z", "pagination": {}}
    table = build_table("get_sales_report", data, "en")
    assert table["title"] == "Sales by agency" and len(table["rows"]) == 50
    assert table["truncated"] and table["asOf"] == "2026-11-15T02:00:00Z"
    more = build_table("list_products", {"items": [], "pagination": {"nextCursor": "x"}}, "vi")
    assert more["truncated"] and more["rows"] == []


def test_build_table_ignores_tools_without_tables_and_bad_payloads():
    assert build_table("get_dashboard", {"items": []}, "vi") is None
    assert build_table("list_agencies", "text", "vi") is None
    assert build_table("list_agencies", {"items": "x"}, "vi") is None
    table = build_table("list_agencies", {"items": [1, {"code": "DL-1"}]}, "vi")
    assert len(table["rows"]) == 1
    assert {spec.columns[0][2] for spec in TABLES.values()} <= {"code", "date"}


# -- numbers -----------------------------------------------------------------------
def test_numbers_in_and_scrub():
    found = orch.numbers_in({"a": [12, 3.5, "1.234.567,8", None, True], "b": "x 2743800"})
    assert {"12", "3", "1234567", "2743800"} <= found
    allowed = {"2743800", "48181944"}
    answer = "Nợ 2.743.800 VND (48181944), năm 2026, ngày 01/10/2026, sai 9.999.999 và 12345."
    assert orch.scrub_numbers(answer, allowed) == (
        "Nợ 2.743.800 VND (48181944), năm 2026, ngày 01/10/2026, sai … và …."
    )
    assert orch.scrub_numbers("Tỷ lệ 15,50 và 123", {"15"}) == "Tỷ lệ 15,50 và 123"


def test_system_prompt_language_and_date():
    prompt = orch.system_prompt("2026-11-15", "ja")
    assert "Japanese" in prompt and "2026-11-15" in prompt and "list_agencies" in prompt
    assert "English" in orch.system_prompt("2026-11-15", "xx")


# -- LLM client --------------------------------------------------------------------
def completion(message: dict) -> dict:
    return {"choices": [{"message": message}]}


def test_llm_client_falls_back_across_models_and_parses_tool_calls():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        seen.append((body["model"], request.headers.get("authorization"), "tools" in body))
        assert body["stream"] is False
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
                        {"id": "1", "function": {"name": "list_agencies", "arguments": "{}"}},
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
    reply = run(client.chat([{"role": "user", "content": "hi"}], [{"type": "function"}]))
    assert reply.model == "d" and reply.content == "Xin chào"
    assert [call["id"] for call in reply.tool_calls] == ["1"]
    assert [model for model, _, _ in seen] == ["a", "b", "c", "d"]
    assert seen[0][1] == "Bearer secret" and seen[0][2]
    run(client.chat([], []))
    assert seen[-1][2] is False  # no tools -> no tools/tool_choice keys


@pytest.mark.parametrize(
    "payload",
    [{"choices": []}, completion("text"), completion({"tool_calls": "x"}), {"x": 1}],
)
def test_llm_client_raises_when_every_model_fails(payload):
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
    client = LLMClient("http://router.test/v1", "", ["only"], 5, transport)
    assert "Authorization" not in client.headers
    with pytest.raises(LLMUnavailable):
        run(client.chat([], []))
    with pytest.raises(LLMUnavailable, match="no model"):
        run(LLMClient("http://router.test/v1", "", [], 5, transport).chat([], []))


# -- MCP client wrapper -------------------------------------------------------------
class FakeFastMcpClient:
    def __init__(self, results=None, tools=None):
        self.results = results or {}
        self.tools = tools or []
        self.calls = []

    async def list_tools(self):
        return self.tools

    async def call_tool(self, name, arguments, raise_on_error=True):
        self.calls.append((name, arguments))
        result = self.results[name]
        if isinstance(result, Exception):
            raise result
        return result


def test_mcp_tools_convert_definitions_and_results():
    tools = [
        SimpleNamespace(name="list_agencies", description="List", input_schema={"type": "object"}),
        SimpleNamespace(name="get_business_rules", description=None, input_schema=None),
    ]
    results = {
        "list_agencies": SimpleNamespace(structured_content=AGENCIES, meta=None, content=[]),
        "wrapped": SimpleNamespace(
            structured_content={"result": [1, 2]},
            meta={"fastmcp": {"wrap_result": True}},
            content=[],
        ),
        "text": SimpleNamespace(
            structured_content=None, content=[SimpleNamespace(text="a"), SimpleNamespace()]
        ),
        "denied": ToolError("HTTP error 403: Forbidden"),
    }
    wrapper = McpTools(FakeFastMcpClient(results, tools))
    definitions = run(wrapper.openai_tools())
    assert definitions[0]["function"] == {
        "name": "list_agencies",
        "description": "List",
        "parameters": {"type": "object"},
    }
    assert definitions[1]["function"]["parameters"] == {"type": "object", "properties": {}}
    assert definitions[1]["function"]["description"] == "get_business_rules"
    assert run(wrapper.call("list_agencies", {"q": "x"})) == ToolOutcome(True, AGENCIES)
    assert run(wrapper.call("wrapped", {})) == ToolOutcome(True, [1, 2])
    assert run(wrapper.call("text", {})) == ToolOutcome(True, "a")
    denied = run(wrapper.call("denied", {}))
    assert not denied.ok and "403" in denied.data


def test_connect_authenticates_and_maps_failures(monkeypatch):
    created = {}

    class FakeTransport:
        def __init__(self, url, headers):
            created["transport"] = (url, headers)

    class FakeClient:
        fail = False

        def __init__(self, transport, timeout):
            created["timeout"] = timeout

        async def __aenter__(self):
            if FakeClient.fail:
                raise RuntimeError("401")
            return self

        async def __aexit__(self, *args):
            created["closed"] = True

    monkeypatch.setattr(mcp_client, "StreamableHttpTransport", FakeTransport)
    monkeypatch.setattr(mcp_client, "Client", FakeClient)

    async def use():
        async with mcp_client.connect("http://mcp.test/mcp", "tok", 7) as tools:
            return tools

    assert isinstance(run(use()), McpTools)
    assert created["transport"] == ("http://mcp.test/mcp", {"Authorization": "Bearer tok"})
    assert created["timeout"] == 7 and created["closed"]
    FakeClient.fail = True
    with pytest.raises(McpUnavailable):
        run(use())


# -- orchestrator ------------------------------------------------------------------
class FakeTools:
    def __init__(self, outcomes=None):
        self.outcomes = outcomes or {}
        self.calls = []

    async def openai_tools(self):
        return [{"type": "function", "function": {"name": "list_agencies"}}]

    async def call(self, name, arguments):
        self.calls.append((name, arguments))
        return self.outcomes.get(name, ToolOutcome(False, "unknown tool"))


class ScriptedClient:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls: list[list[dict]] = []

    async def chat(self, messages, tools):
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


def loop(client, fake=None, locale="vi", steps=4, deadline=45, question="Minh Phát 2026?"):
    fake = fake or FakeTools({"list_agencies": ToolOutcome(True, AGENCIES)})
    turns = [{"role": "user", "content": question}]
    orchestrator = orch.Orchestrator(client, steps, deadline)
    return run(orchestrator.run(fake, turns, "2026-11-15", locale)), fake


def test_orchestrator_answers_with_tables_from_tool_results():
    client = ScriptedClient(
        tools(call("list_agencies", {"q": "Minh Phát"})),
        say("DL-8 nợ 2.743.800 đồng, DL-23 nợ 3.696.480 đồng, không phải 123.456.789."),
    )
    reply, fake = loop(client)
    assert fake.calls == [("list_agencies", {"q": "Minh Phát"})]
    assert reply["answer"] == "DL-8 nợ 2.743.800 đồng, DL-23 nợ 3.696.480 đồng, không phải …."
    assert reply["tools"] == ["list_agencies"] and reply["model"] == "m1"
    assert reply["tables"][0]["rows"][1]["agencyCode"] == "DL-23"
    tool_message = client.calls[1][-1]
    assert tool_message["role"] == "tool" and tool_message["tool_call_id"] == "c1"
    assert client.calls[0][0]["role"] == "system"


def test_orchestrator_feeds_errors_back_and_answers_without_table():
    fake = FakeTools(
        {
            "get_business_rules": ToolOutcome(True, {"maxAgenciesPerWard": 4}),
            "get_debt_report": ToolOutcome(False, "HTTP error 403: Forbidden"),
        }
    )
    client = ScriptedClient(
        tools(
            call("get_business_rules", raw="{not json"),
            call("get_debt_report", raw="[1]", id_=""),
        ),
        say("Bạn chưa có quyền xem báo cáo công nợ."),
    )
    reply, _ = loop(client, fake)
    assert reply["tables"] == [] and reply["tools"] == ["get_business_rules", "get_debt_report"]
    messages = client.calls[1]
    assert json.loads(messages[-2]["content"]) == {"maxAgenciesPerWard": 4}
    assert json.loads(messages[-1]["content"])["error"].startswith("HTTP error 403")
    assert messages[-1]["tool_call_id"] == "get_debt_report"


def test_orchestrator_accepts_object_arguments_and_empty_answer():
    raw = {"id": "c1", "function": {"name": "list_agencies", "arguments": {"q": "x"}}}
    reply, fake = loop(ScriptedClient(tools(raw), say("")), locale="en")
    assert fake.calls == [("list_agencies", {"q": "x"})]
    assert reply["answer"] == "Here are the results."


def test_orchestrator_keeps_at_most_three_tables_and_truncates_payload():
    big = {"items": [{"code": "DL-1", "name": "x" * 100}] * 200}
    fake = FakeTools({"list_agencies": ToolOutcome(True, big)})
    query = call("list_agencies")
    client = ScriptedClient(tools(query, query, query, query), say("Xong."))
    reply, _ = loop(client, fake)
    assert len(reply["tables"]) == 3
    assert len(client.calls[1][-1]["content"]) == orch.MAX_TOOL_PAYLOAD


def test_orchestrator_unavailable_exhausted_and_deadline():
    with pytest.raises(LLMUnavailable):
        loop(ScriptedClient(LLMUnavailable("down")))
    query = call("list_agencies")
    reply, _ = loop(ScriptedClient(tools(query), LLMUnavailable("down")))
    assert reply["answer"] == "Đây là kết quả tra cứu." and reply["tables"]
    reply, _ = loop(ScriptedClient(tools(query), tools(query)), steps=2, locale="en")
    assert reply["answer"] == "Here are the results."
    with pytest.raises(LLMUnavailable, match="exhausted"):
        loop(ScriptedClient(tools(call("get_dashboard"))), steps=1)
    with pytest.raises(LLMUnavailable):
        loop(ScriptedClient(), deadline=-1)


# -- service -----------------------------------------------------------------------
def request(**values) -> ChatbotMessageRequest:
    body = {"messages": [{"role": "user", "content": "Ai nợ nhiều nhất?"}]} | values
    return ChatbotMessageRequest.model_validate(body)


def service(client=None, fake=None, limiter=None, fail=None, **overrides):
    opened = {}

    @asynccontextmanager
    async def connect(url, token, timeout):
        if fail is not None:
            raise fail
        opened.update(url=url, token=token, timeout=timeout)
        yield fake or FakeTools({"list_agencies": ToolOutcome(True, AGENCIES)})

    chatbot = ChatbotService(
        Mock(),
        settings(**(READY | overrides)),
        Mock(),
        limiter=limiter,
        client=client,
        connect=connect,
    )
    chatbot._admit = lambda token: (7, "2026-11-15")
    chatbot.opened = opened
    return chatbot


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


def test_service_runs_the_loop_through_mcp_with_the_user_token():
    client = ScriptedClient(tools(call("list_agencies", {"q": "Minh Phát"})), say("Ok"))
    chatbot = service(client)
    reply = chatbot.send("user-token", request())
    assert chatbot.opened == {"url": "http://mcp.test/mcp", "token": "user-token", "timeout": 20}
    dumped = reply.model_dump(mode="json", exclude_none=True)
    assert dumped["tables"][0]["totalRows"] == 2 and dumped["tools"] == ["list_agencies"]


@pytest.mark.parametrize("failure", ["llm", "mcp"])
def test_service_maps_llm_and_mcp_failures_to_503(failure):
    if failure == "llm":
        chatbot = service(ScriptedClient(LLMUnavailable("down")))
    else:
        chatbot = service(ScriptedClient(), fail=McpUnavailable("ConnectError"))
    with pytest.raises(ApiError) as error:
        chatbot.send("t", request())
    assert error.value.code == "CHATBOT_UNAVAILABLE"


def test_service_builds_llm_client_from_settings():
    chatbot = ChatbotService(Mock(), settings(**READY, chatbot_llm_api_key="k"), Mock())
    client = chatbot._client()
    assert client.models == ["model-a", "model-b"] and client.headers["Authorization"] == "Bearer k"
    assert chatbot.connect is mcp_client.connect


def test_service_admit_rejects_bad_token_before_database():
    engine = Mock()
    chatbot = ChatbotService(engine, settings(**READY), Mock())
    with pytest.raises(AuthError) as error:
        chatbot.send("not-a-jwt", request())
    assert error.value.status == 401
    engine.connect.assert_not_called()


def test_service_admit_authenticates_in_a_read_only_transaction(monkeypatch):
    from app.modules.chatbot import service as module

    connection = Mock()
    engine = Mock()
    engine.connect.return_value.__enter__ = Mock(return_value=connection)
    engine.connect.return_value.__exit__ = Mock(return_value=False)
    configured = connection.execution_options.return_value
    configured.begin.return_value.__enter__ = Mock()
    configured.begin.return_value.__exit__ = Mock(return_value=False)
    session = Mock()
    session.execute.return_value.scalar_one.return_value = date(2026, 11, 15)

    @contextmanager
    def fake_session(bind):
        assert bind is configured
        yield session

    class FakeAuth:
        def __init__(self, *args, **kwargs):
            pass

        def authenticate(self, token):
            return SimpleNamespace(user_id=9)

    monkeypatch.setattr(module, "decode_access_token", lambda *args: None)
    monkeypatch.setattr(module, "Session", fake_session)
    monkeypatch.setattr(module, "AuthService", FakeAuth)
    chatbot = ChatbotService(engine, settings(**READY), Mock())
    assert chatbot._admit("t") == (9, "2026-11-15")
    connection.execution_options.assert_called_once_with(postgresql_readonly=True)


# -- dependencies and HTTP route -----------------------------------------------------
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
        return {"answer": "Kỳ nào?", "tables": [], "tools": []}


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
    assert response.json() == {"answer": "Kỳ nào?", "tables": [], "tools": []}
    assert fake.tokens == ["abc"]
    assert client.post(url, json=body).status_code == 401
    response = client.post(
        url, content="x", headers={"Authorization": "Bearer abc", "Content-Type": "text/plain"}
    )
    assert response.status_code == 415
    bad = {"messages": [], "resume": {}}
    response = client.post(url, json=bad, headers={"Authorization": "Bearer abc"})
    assert response.status_code == 422
    spec = client.get("/api/openapi.json").json()["paths"]["/api/v1/chatbot/messages"]["post"]
    assert spec["operationId"] == "sendChatbotMessage"
    assert "conditional" in spec["x-permissions"]
    assert {"200", "401", "415", "422", "429", "503"} <= set(spec["responses"])


def test_dependency_factory_builds_service():
    state = SimpleNamespace(engine=Mock(), settings=settings(), reset_delivery=Mock())
    built = chatbot_dependencies.get_chatbot_service(
        SimpleNamespace(app=SimpleNamespace(state=state))
    )
    assert isinstance(built, ChatbotService) and built.limiter is not None
