"""MCP client side of the web assistant: the Agentra MCP server (`mcp-server/`) owns the
tools; this module lists them and calls them with the user's own bearer token."""

from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any

from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport
from fastmcp.exceptions import ToolError

# JSON Schema keys that cost model tokens without helping it choose arguments; the
# backend still validates every argument against the full contract.
DROPPED_SCHEMA_KEYS = frozenset({"title", "pattern", "minLength", "maxLength"})


def compact_schema(node: Any) -> Any:
    """A smaller schema with the same meaning for the model: `anyOf [X, null]` -> X, no
    titles or regex patterns, whole-number floats as integers."""
    if isinstance(node, list):
        return [compact_schema(item) for item in node]
    if isinstance(node, float) and node.is_integer():
        return int(node)
    if not isinstance(node, dict):
        return node
    options = node.get("anyOf")
    if isinstance(options, list):
        concrete = [option for option in options if option != {"type": "null"}]
        if len(concrete) == 1 and isinstance(concrete[0], dict):
            rest = {key: value for key, value in node.items() if key != "anyOf"}
            return compact_schema(concrete[0] | rest)
    result = {}
    for key, value in node.items():
        if key == "properties" and isinstance(value, dict):
            result[key] = {name: compact_schema(item) for name, item in value.items()}
        elif key not in DROPPED_SCHEMA_KEYS:
            result[key] = compact_schema(value)
    return result


class McpUnavailable(Exception):
    """The MCP server cannot be reached or rejected the session."""


@dataclass(frozen=True)
class ToolOutcome:
    ok: bool
    data: Any  # structured JSON on success, error text otherwise


class McpTools:
    def __init__(self, client: Client):
        self.client = client

    async def openai_tools(self) -> list[dict]:
        """`tools/list` converted to OpenAI function-calling definitions."""
        result = []
        for tool in await self.client.list_tools():
            schema = compact_schema(tool.input_schema or {"type": "object", "properties": {}})
            result.append(
                {
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": (tool.description or tool.name)[:1000],
                        "parameters": schema,
                    },
                }
            )
        return result

    async def call(self, name: str, arguments: dict) -> ToolOutcome:
        try:
            result = await self.client.call_tool(name, arguments, raise_on_error=True)
        except ToolError as error:
            return ToolOutcome(False, str(error)[:1500])
        if result.structured_content is not None:
            data = result.structured_content
            meta = getattr(result, "meta", None) or {}
            if isinstance(data, dict) and meta.get("fastmcp", {}).get("wrap_result"):
                data = data.get("result", data)
            return ToolOutcome(True, data)
        text = "".join(getattr(part, "text", "") for part in result.content or [])
        return ToolOutcome(True, text)


@asynccontextmanager
async def connect(url: str, token: str, timeout: float):
    """One MCP session per chat message, authenticated as the requesting user."""
    transport = StreamableHttpTransport(url, headers={"Authorization": f"Bearer {token}"})
    client = Client(transport, timeout=timeout)
    try:
        await client.__aenter__()
    except Exception as error:  # noqa: BLE001 - any connect/auth failure means unavailable
        raise McpUnavailable(type(error).__name__) from None
    try:
        yield McpTools(client)
    finally:
        await client.__aexit__(None, None, None)
