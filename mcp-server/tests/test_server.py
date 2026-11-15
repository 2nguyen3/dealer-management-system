"""Offline tests: tool selection over the real backend contract, bearer verification,
token forwarding, permission filtering and a full in-memory tool call. The backend is
replaced by httpx2 mock transports; no network or database is used."""

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import httpx2
import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError

from agentra_mcp import server as server_module
from agentra_mcp.auth import MAX_CACHED, AgentraTokenVerifier
from agentra_mcp.config import Settings, get_settings
from agentra_mcp.server import PermissionFilter, build_server, customize, forward_token, load_spec
from agentra_mcp.tools import TOOLS, allowed, permissions, select_operations, tool_name

CONTRACT = Path(__file__).resolve().parents[2] / "openwiki/backend-design/API/openapi.json"
CONTRACT_SPEC = json.loads(CONTRACT.read_text(encoding="utf-8"))
# The runtime /api/openapi.json carries full /api/v1 paths and no servers block.
SPEC = {
    **{key: value for key, value in CONTRACT_SPEC.items() if key != "servers"},
    "paths": {f"/api/v1{path}": item for path, item in CONTRACT_SPEC["paths"].items()},
}
SCOPES = [
    "agency.read",
    "debt.read",
    "sales.read",
    "reports.read",
    "product.manage",
    "rules.manage",
]
ME = {
    "user": {"id": 7, "email": "a@example.test", "fullName": "Nguyễn An"},
    "allowedFunctions": ["agency.read", "debt.read"],
}


def run(coro):
    return asyncio.run(coro)


def settings(**values) -> Settings:
    return Settings(_env_file=None, agentra_api_url="http://api.test/", **values)


# -- tool selection -----------------------------------------------------------------
def test_tool_names_and_selection_cover_only_read_operations():
    assert tool_name("listAgencies") == "list_agencies"
    assert tool_name("getProductSalesReport") == "get_product_sales_report"
    selected = select_operations(SPEC)
    operations = [methods["get"]["operationId"] for methods in selected["paths"].values()]
    assert sorted(operations) == sorted(TOOLS)
    assert all(set(methods) <= {"get", "parameters"} for methods in selected["paths"].values())
    assert selected["components"] is SPEC["components"]


def test_selection_fails_when_the_backend_lacks_an_operation():
    with pytest.raises(RuntimeError, match="getDashboard"):
        select_operations({"paths": {"/x": {"get": {"operationId": "listAgencies"}}}})
    spec = {"paths": {"/a": {"parameters": [], "get": {"operationId": "x"}, "post": {}}}}
    with pytest.raises(RuntimeError):
        select_operations(spec)


def test_permission_rules():
    assert permissions({}) == (frozenset(), frozenset())
    rule = permissions({"x-permissions": {"anyOf": ["a", "b"], "allOf": ["c"]}})
    assert rule == (frozenset({"a", "b"}), frozenset({"c"}))
    assert allowed(rule, frozenset({"b", "c"}))
    assert not allowed(rule, frozenset({"a"}))
    assert not allowed(rule, frozenset({"c"}))
    assert allowed((frozenset(), frozenset()), frozenset())


def test_settings_defaults_and_cache():
    current = Settings(_env_file=None)
    assert (current.mcp_port, current.mcp_path, current.agentra_api_url) == (
        8100,
        "/mcp",
        "http://localhost:8000",
    )
    assert get_settings() is get_settings()


# -- bearer verification ------------------------------------------------------------
def test_verifier_accepts_backend_users_and_caches_them():
    calls = []

    def handler(request: httpx2.Request) -> httpx2.Response:
        calls.append(request.headers["authorization"])
        assert str(request.url) == "http://api.test/api/v1/auth/me"
        return httpx2.Response(200, json=ME)

    verifier = AgentraTokenVerifier(
        "http://api.test/", cache_seconds=30, transport=httpx2.MockTransport(handler)
    )
    access = run(verifier.verify_token("tok"))
    assert access.client_id == "7" and access.scopes == ["agency.read", "debt.read"]
    assert access.claims == {"email": "a@example.test", "name": "Nguyễn An"}
    assert run(verifier.verify_token("tok")) is access
    assert calls == ["Bearer tok"]


def test_verifier_rejects_and_forgets_invalid_tokens():
    status = {"code": 200}

    def handler(request):
        return httpx2.Response(status["code"], json={"allowedFunctions": None})

    verifier = AgentraTokenVerifier(
        "http://api.test", cache_seconds=0, transport=httpx2.MockTransport(handler)
    )
    access = run(verifier.verify_token("t"))
    assert access.client_id == "agentra" and access.scopes == []
    status["code"] = 401
    assert run(verifier.verify_token("t")) is None


def test_verifier_handles_network_errors_and_bounds_its_cache():
    def down(request):
        raise httpx2.ConnectError("down")

    verifier = AgentraTokenVerifier("http://api.test", transport=httpx2.MockTransport(down))
    assert run(verifier.verify_token("t")) is None
    ok = AgentraTokenVerifier(
        "http://api.test", transport=httpx2.MockTransport(lambda r: httpx2.Response(200, json=ME))
    )
    ok._cache = {str(i): (0, None) for i in range(MAX_CACHED)}
    run(ok.verify_token("t"))
    assert len(ok._cache) == 1


# -- token forwarding and permission filtering --------------------------------------
def test_forward_token_sets_the_caller_token(monkeypatch):
    request = httpx2.Request("GET", "http://api.test/x")
    monkeypatch.setattr(server_module, "get_access_token", lambda: None)
    run(forward_token(request))
    assert "authorization" not in request.headers
    monkeypatch.setattr(server_module, "get_access_token", lambda: SimpleNamespace(token="abc"))
    run(forward_token(request))
    assert request.headers["authorization"] == "Bearer abc"


def test_permission_filter_hides_tools(monkeypatch):
    rules = {"get_debt_report": (frozenset({"reports.read"}), frozenset())}
    tools = [SimpleNamespace(name="get_debt_report"), SimpleNamespace(name="list_agencies")]

    async def call_next(context):
        return tools

    middleware = PermissionFilter(rules)
    monkeypatch.setattr(server_module, "get_access_token", lambda: None)
    assert run(middleware.on_list_tools(None, call_next)) == tools
    monkeypatch.setattr(
        server_module, "get_access_token", lambda: SimpleNamespace(scopes=["agency.read"])
    )
    assert [t.name for t in run(middleware.on_list_tools(None, call_next))] == ["list_agencies"]


# -- startup ------------------------------------------------------------------------
def test_load_spec_retries_until_the_backend_answers():
    attempts = []

    def handler(request):
        attempts.append(str(request.url))
        if len(attempts) == 1:
            raise httpx2.ConnectError("starting")
        if len(attempts) == 2:
            return httpx2.Response(503)
        if len(attempts) == 3:
            return httpx2.Response(200, text="not json")
        return httpx2.Response(200, json={"paths": {}})

    sleeps = []
    spec = load_spec(settings(), httpx2.MockTransport(handler), sleeps.append)
    assert spec == {"paths": {}} and attempts[0] == "http://api.test/api/openapi.json"
    assert sleeps == [2, 4, 6]
    with pytest.raises(RuntimeError, match="Cannot load"):
        load_spec(
            settings(mcp_startup_retries=1),
            httpx2.MockTransport(lambda r: httpx2.Response(500)),
            lambda s: None,
        )


def test_customize_adds_hints_and_read_only_annotations():
    component = SimpleNamespace(name="list_agencies", description="", annotations=None)
    route = SimpleNamespace(operation_id="listAgencies", summary="List agencies")
    customize(route, component)
    assert component.description.startswith("List agencies. Search agencies")
    assert component.annotations.read_only_hint and not component.annotations.destructive_hint
    bare = SimpleNamespace(name="x", description="", annotations=None)
    customize(SimpleNamespace(operation_id=None, summary=None), bare)
    assert bare.description == "x."


# -- full server --------------------------------------------------------------------
def backend(seen):
    def handler(request: httpx2.Request) -> httpx2.Response:
        seen.append(
            (request.url.path, dict(request.url.params), request.headers.get("authorization"))
        )
        if request.url.path == "/api/v1/reports/debt":
            return httpx2.Response(403, json={"code": "FORBIDDEN", "message": "Forbidden"})
        return httpx2.Response(
            200, json={"items": [{"id": "8", "code": "DL-8"}], "pagination": {"hasMore": False}}
        )

    return httpx2.MockTransport(handler)


def test_server_exposes_read_only_tools_and_forwards_calls(monkeypatch):
    seen = []
    mcp = build_server(settings(), SPEC, transport=backend(seen))
    monkeypatch.setattr(
        server_module, "get_access_token", lambda: SimpleNamespace(token="tok", scopes=SCOPES)
    )

    async def scenario():
        async with Client(mcp) as client:
            tools = await client.list_tools()
            result = await client.call_tool("list_agencies", {"q": "Minh Phát", "limit": 5})
            with pytest.raises(ToolError):
                await client.call_tool(
                    "get_debt_report", {"fromDate": "2026-10-01", "toDate": "2026-11-01"}
                )
            return tools, result

    tools, result = run(scenario())
    assert {tool.name for tool in tools} == {tool_name(op) for op in TOOLS}
    assert all(tool.annotations.read_only_hint for tool in tools)
    assert result.structured_content["items"][0]["code"] == "DL-8"
    assert seen[0] == ("/api/v1/agencies", {"q": "Minh Phát", "limit": "5"}, "Bearer tok")
    assert seen[1][0] == "/api/v1/reports/debt"


def test_server_health_route_and_default_verifier():
    from starlette.testclient import TestClient

    mcp = build_server(settings(mcp_public_url="http://localhost:8100"), SPEC)
    assert isinstance(mcp.auth, AgentraTokenVerifier)
    with TestClient(mcp.http_app(path="/mcp", stateless_http=True)) as http:
        assert http.get("/healthz").json() == {"status": "ok", "tools": len(TOOLS)}
        assert http.post("/mcp", json={}).status_code == 401


def test_asgi_app_and_vercel_entrypoint(monkeypatch):
    import runpy

    from starlette.testclient import TestClient

    loaded = []
    monkeypatch.setattr(server_module, "load_spec", lambda current: loaded.append(current) or SPEC)
    app = server_module.asgi_app(settings())
    with TestClient(app) as http:
        assert http.get("/healthz").json()["tools"] == len(TOOLS)
        assert http.post("/mcp", json={}).status_code == 401
    monkeypatch.setenv("AGENTRA_API_URL", "https://agentra.test")
    entry = runpy.run_path(str(Path(__file__).resolve().parents[1] / "index.py"))["app"]
    assert loaded[-1].agentra_api_url == "https://agentra.test" and entry is not None
    monkeypatch.setattr(server_module, "get_settings", lambda: settings())
    assert server_module.asgi_app() is not None
