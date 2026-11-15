"""FastMCP server built from the backend's own OpenAPI document (`from_openapi`)."""

import logging
import time

import httpx2
from fastmcp import FastMCP
from fastmcp.server.dependencies import get_access_token
from fastmcp.server.middleware import Middleware
from mcp.types import ToolAnnotations
from starlette.requests import Request
from starlette.responses import JSONResponse

from agentra_mcp.auth import AgentraTokenVerifier
from agentra_mcp.config import Settings, get_settings
from agentra_mcp.tools import TOOLS, Rule, allowed, permissions, select_operations, tool_name

logger = logging.getLogger("agentra_mcp")

INSTRUCTIONS = (
    "Read-only tools over the Agentra dealer management system (Vietnam): agencies (dai ly) "
    "and their debt, products and stock, documents PN/PX/PT and reports. Resolve an agency "
    "or product name with list_agencies/list_products (q=...) before using its id; when "
    "several match, ask the user which code. Never invent figures."
)
OPEN: Rule = (frozenset(), frozenset())


async def forward_token(request: httpx2.Request) -> None:
    """Every backend call carries the caller's own Agentra token."""
    access = get_access_token()
    if access is not None:
        request.headers["Authorization"] = f"Bearer {access.token}"


class PermissionFilter(Middleware):
    """Hides tools whose backend x-permissions the caller does not hold."""

    def __init__(self, rules: dict[str, Rule]):
        self.rules = rules

    async def on_list_tools(self, context, call_next):
        tools = await call_next(context)
        access = get_access_token()
        if access is None:
            return tools
        granted = frozenset(access.scopes)
        return [tool for tool in tools if allowed(self.rules.get(tool.name, OPEN), granted)]


def load_spec(
    settings: Settings,
    transport: httpx2.BaseTransport | None = None,
    sleep=time.sleep,
) -> dict:
    """The runtime OpenAPI document of the backend (tools always match the live API)."""
    url = settings.agentra_api_url.rstrip("/") + "/api/openapi.json"
    last: Exception | None = None
    for attempt in range(settings.mcp_startup_retries):
        try:
            with httpx2.Client(timeout=10, transport=transport) as client:
                response = client.get(url)
                response.raise_for_status()
                return response.json()
        except (httpx2.HTTPError, ValueError) as error:
            last = error
            logger.warning("backend OpenAPI not ready (%s), attempt %d", error, attempt + 1)
            sleep(min(2 * (attempt + 1), 10))
    raise RuntimeError(f"Cannot load backend OpenAPI from {url}") from last


def customize(route, component) -> None:
    """Description = backend summary + LLM hints; every tool is read-only."""
    hint = TOOLS.get(route.operation_id or "", "")
    summary = route.summary or route.operation_id or component.name
    component.description = f"{summary}. {hint}".strip()
    component.annotations = ToolAnnotations(
        title=summary, read_only_hint=True, destructive_hint=False, open_world_hint=False
    )


def build_server(
    settings: Settings,
    spec: dict,
    *,
    transport: httpx2.AsyncBaseTransport | None = None,
    verifier: AgentraTokenVerifier | None = None,
) -> FastMCP:
    selected = select_operations(spec)
    rules = {
        tool_name(methods["get"]["operationId"]): permissions(methods["get"])
        for methods in selected["paths"].values()
    }
    client = httpx2.AsyncClient(
        base_url=settings.agentra_api_url.rstrip("/"),
        timeout=settings.mcp_request_timeout_seconds,
        transport=transport,
        event_hooks={"request": [forward_token]},
    )
    auth = verifier or AgentraTokenVerifier(
        settings.agentra_api_url,
        cache_seconds=settings.mcp_token_cache_seconds,
        base_url=settings.mcp_public_url or None,
    )
    server = FastMCP.from_openapi(
        selected,
        client=client,
        name="Agentra DMS",
        mcp_names={operation: tool_name(operation) for operation in TOOLS},
        mcp_component_fn=customize,
        validate_output=False,
        instructions=INSTRUCTIONS,
        auth=auth,
    )
    server.add_middleware(PermissionFilter(rules))

    @server.custom_route("/healthz", methods=["GET"])
    async def healthz(request: Request) -> JSONResponse:
        return JSONResponse({"status": "ok", "tools": len(rules)})

    return server


def asgi_app(settings: Settings | None = None):
    """Stateless Streamable HTTP app with JSON responses, for hosted runtimes (Vercel)."""
    settings = settings or get_settings()
    server = build_server(settings, load_spec(settings))
    return server.http_app(path=settings.mcp_path, stateless_http=True, json_response=True)


def main() -> None:  # pragma: no cover - process entry point
    logging.basicConfig(level=logging.INFO)
    settings = get_settings()
    server = build_server(settings, load_spec(settings))
    server.run(
        transport="http",
        host=settings.mcp_host,
        port=settings.mcp_port,
        path=settings.mcp_path,
        stateless_http=True,
        json_response=True,
    )


if __name__ == "__main__":  # pragma: no cover
    main()
