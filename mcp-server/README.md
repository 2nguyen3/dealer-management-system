# Agentra MCP server

Read-only [MCP](https://modelcontextprotocol.io) server for Agentra DMS, built with
[FastMCP](https://gofastmcp.com). It wraps existing backend read APIs as tools; the web
assistant (`POST /api/v1/chatbot/messages`) and external clients (Claude Code, Claude
Desktop, Cursor, other agents) all use it. Contract and decisions:
`../openwiki/backend-design/plan/chatbot/CONTRACT.md`.

## How it works

- At startup it downloads the backend's runtime `GET /api/openapi.json` (with retries),
  keeps the 19 GET operations listed in `agentra_mcp/tools.py` and builds tools with
  `FastMCP.from_openapi`. Tool names are snake_case operation ids (`list_agencies`,
  `get_debt_report`, …); all carry `readOnlyHint`.
- Authentication: `Authorization: Bearer <Agentra access token>`. A token is accepted when
  `GET /api/v1/auth/me` accepts it (cached `MCP_TOKEN_CACHE_SECONDS`); the user's
  `allowedFunctions` become token scopes, used to hide tools whose `x-permissions` the
  user lacks. No token → `401` with `WWW-Authenticate`.
- Every tool call is forwarded to the backend with the same token, so the backend's RBAC
  and figures apply unchanged. The server has no database access and no secrets.
- Transport: Streamable HTTP, stateless, JSON responses, at `MCP_PATH` (`/mcp`).
  `GET /healthz` returns `{"status": "ok", "tools": 19}`.

## Run

Python 3.12 and uv. With the backend running on `AGENTRA_API_URL`:

```sh
uv sync --frozen
uv run python -m agentra_mcp          # http://127.0.0.1:8100/mcp
```

Docker Compose (repository root) runs it as service `mcp` on `127.0.0.1:8100`, after the
backend is healthy; the backend reaches it at `http://mcp:8100/mcp` (`CHATBOT_MCP_URL`).

Vercel: service `mcp` in the root `vercel.json` (root `mcp-server/`, entrypoint
`index:app`, which calls `asgi_app()`), served at https://agentra-dms.vercel.app/mcp. Its
settings come from the project environment (`backend/deploy_vercel_env.py --chatbot`).

Settings (`.env.example`): `AGENTRA_API_URL`, `MCP_HOST`, `MCP_PORT`, `MCP_PATH`,
`MCP_PUBLIC_URL`, `MCP_TOKEN_CACHE_SECONDS`, `MCP_REQUEST_TIMEOUT_SECONDS`,
`MCP_STARTUP_RETRIES`.

## Connect a client

Use `https://agentra-dms.vercel.app/mcp` (production) or `http://localhost:8100/mcp`.
Get an access token with `POST /api/v1/auth/login` (it expires after about 15 minutes;
OAuth is a later phase), then:

```sh
claude mcp add --transport http agentra http://localhost:8100/mcp \
  --header "Authorization: Bearer <access token>"
```

```json
{ "mcpServers": { "agentra": { "url": "http://localhost:8100/mcp",
  "headers": { "Authorization": "Bearer <access token>" } } } }
```

## Checks

```sh
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

Tests are offline: they use the committed contract
(`../openwiki/backend-design/API/openapi.json`) and mock the backend with httpx2
transports, including full in-memory tool calls.

To add a tool, add an existing GET `operationId` and a short hint to `TOOLS`; the server
refuses to start if the backend lacks an operation.
