# M32 Chatbot Contract

Revised: 2026-11-15. Status: implemented. The web assistant (`POST /chatbot/messages`,
`backend/app/modules/chatbot/`) runs an LLM tool loop whose tools come from the Agentra
MCP server (`mcp-server/`, FastMCP). The semantic model and its engine (first phase-1
build, same day) were removed on request: the MCP server wraps the existing read APIs
instead. OAuth for external MCP clients is not started.

This revision supersedes the fixed-slot `POST /chatbot/queries` (`queryChatbot`),
decision [D10](../full_backend/DECISIONS.md) (candidate paging through `/agencies`), the
F32 page plans under `openwiki/frontend-design/plan/chatbot/` and the 13/11 draft with a
semantic model. The current architecture page is `tmp/kien-truc-chatbot.html` (local).

## Files

| File | Role |
| --- | --- |
| [chatbot.openapi.yaml](chatbot.openapi.yaml) | Design-first HTTP contract of `sendChatbotMessage` (`POST /chatbot/messages`). |
| `API/openapi.json` | Generated from the runtime app: 92 operations including `sendChatbotMessage`. |
| this file | Architecture, MCP tools, permissions, settings and decisions. |

## Architecture

```text
Web assistant (React, floating) ──HTTPS + Bearer──▶ backend POST /chatbot/messages
                                                     │ orchestrator: LLM tool loop
                                                     │ (OpenAI-compatible provider)
                                                     ▼ fastmcp.Client, same Bearer
Claude / Cursor / agents ──MCP + Bearer──▶ mcp-server  /mcp  (FastMCP, Streamable HTTP)
                                                     │ from_openapi: 19 read tools
                                                     │ verifier GET /auth/me, tool filter
                                                     ▼ httpx, same Bearer
                                           backend REST /api/v1 (RBAC x-permissions)
                                                     ▼
                                           Neon PostgreSQL (backend only)
```

- The MCP server has no database access and no credentials of its own. It loads the
  backend's runtime `/api/openapi.json` at startup and keeps the GET operations listed
  in `mcp-server/agentra_mcp/tools.py`; `FastMCP.from_openapi` turns them into tools.
- Every call carries the caller's own Agentra access token. The MCP server accepts a
  token when `GET /api/v1/auth/me` accepts it (cached 30 s by SHA-256), hides tools whose
  `x-permissions` the user lacks, and forwards the token to the backend, which checks the
  permission again (403). Figures and permissions therefore match the web UI exactly.
- The web orchestrator is an ordinary MCP client of that server.

## MCP tools

Names are the snake_case operation ids. Descriptions are the backend summary plus a
business hint for the LLM; every tool has `readOnlyHint: true`, `destructiveHint: false`.

| Tool | Operation | Permission (from the backend) |
| --- | --- | --- |
| `get_current_user` | `GET /auth/me` | authenticated |
| `get_dashboard` | `GET /dashboard` | any business read permission |
| `list_agencies`, `get_agency` | `GET /agencies`, `/agencies/{agencyId}` | `agency.read` or `agency.manage` |
| `list_agency_types` | `GET /agency-types` | `agency_type.manage`, `agency.read` or `agency.manage` |
| `list_wards` | `GET /wards` | `agency.read` or `agency.manage` |
| `list_products`, `get_product` | `GET /products`, `/products/{productId}` | product readers¹ |
| `get_business_rules` | `GET /business-rules` | `rules.manage`, `agency.manage`, `stock.issue.prepare/post` |
| `search_documents`, `get_document` | `GET /documents`, `/documents/{documentId}` | per document kind |
| `list_stock_issues` | `GET /stock-issues` | `sales.read`, `debt.read`, `reports.read`, issue/correction codes |
| `list_stock_receipts` | `GET /stock-receipts` | `product.manage`, `reports.read`, receipt/correction codes |
| `list_payment_receipts` | `GET /payment-receipts` | `debt.read`, `payments.online`, `reports.read`, cash/correction codes |
| `get_sales_report`, `get_product_sales_report` | `GET /reports/sales`, `/reports/product-sales` | `reports.read` **and** `sales.read` |
| `get_debt_report`, `get_collections_report` | `GET /reports/debt`, `/reports/collections` | `reports.read` **and** `debt.read` |
| `get_inventory_report` | `GET /reports/inventory` | `reports.read` |

¹ anyOf `product.manage`, `stock.receipt.prepare`, `stock.receipt.post`,
`stock.issue.prepare`, `stock.issue.post`, `sales.read`, `reports.read`.

Consequence: sales staff without `reports.read` (groups SALES/WAREHOUSE) cannot use the
report tools; they still read current debt (`list_agencies`) and stock (`list_products`).
Adding a tool = adding an existing GET `operationId` to `TOOLS`; the server refuses to
start if an operation is missing from the backend.

## QĐ16 mapping

| Step | Where |
| --- | --- |
| B1 receive question | `POST /chatbot/messages` (web) or the client's own LLM (MCP). |
| B2 connect to the database | Backend only: each tool is a REST request with its own session. |
| B3 read the data description (D3) | Tool schemas generated from the OpenAPI contract + hints in `tools.py`, sent by `tools/list`. |
| B4 interpret | The LLM chooses tools and arguments. |
| B5 scope, permission, completeness | Only read tools exist; hidden tools + backend 403; 422 for bad arguments; the prompt asks when the period or entity is missing. |
| B6 query; duplicate names → list | `list_agencies`/`list_products` with `q`; several matches → the LLM lists them by code and asks which one. |
| B7 return result | Tables built from tool results (`tables.py`), short answer from the LLM. |

## Reply and tables

`ChatbotReply = {answer, tables[≤3], tools[], model?}`. A table is built only from a
tool result, never from model text, with fixed columns per tool (`tables.py`):

| Tool | Columns |
| --- | --- |
| `list_agencies` | agencyCode, agencyName, wardName, typeName, debt, maxDebt |
| `list_products` | productCode, productName, unitName, stock, lastPurchasePrice, sellingPrice |
| `search_documents`, `list_stock_issues/receipts`, `list_payment_receipts` | documentCode, kind, businessDate, agencyName, status, documentAmount |
| sales/product-sales/debt/inventory reports | code, name and the report amounts |
| `get_collections_report` | businessDate, receiptCount, cash/bank transfer/online/total amounts |

Rows ≤ 50 (`truncated` when the tool returned more or has a next page), `totalRows`,
`asOf` = the tool's `generatedAt` or now. Column types: code, text, money, quantity,
integer, rate, date, status, kind; the UI owns labels (24 locales). Tables never carry
phone numbers, addresses or e-mails.

## HTTP errors

`400/422 VALIDATION_FAILED` (schema, more than 20 turns, last turn not from the user),
`401`, `415`, `429 RATE_LIMIT_EXCEEDED` (per-user `chatbot` bucket, or every model answered
429 and the provider's `Retry-After` exceeds 20 s / the deadline; shorter waits are waited
out once inside the message),
`503 CHATBOT_UNAVAILABLE` (disabled or unconfigured, MCP server unreachable, every model
failed, loop exhausted without data). A forbidden tool call inside a request is not an
HTTP error: the tool error goes back to the LLM, which tells the user they lack access.

## Safety rules

- Figures shown in tables come from tool results; a number in `answer` that appears in
  neither the tool results nor the user's turns is replaced by `…`.
- Tool definitions are sent compacted (no titles/regex patterns, `anyOf [X, null]` → X) and
  tool results without null fields, to save provider tokens; the backend still validates.
- Tool results are sent to the provider (each truncated at 12 000 characters).
  `list_agencies` includes contact data, so phone/address reach the provider; this
  extends the user decision of 13/11/2026 that query results may be sent.
- No write tool exists; permissions belong to the token, not to the prompt.
- The backend logs (logger `app.chatbot`) user id, tool names, model and duration; never
  the question, the answer or results.
- Provider key only in backend settings; the MCP server holds no secrets.

## Settings

Backend (`backend/.env`, Vercel secrets):

| Variable | Default | Meaning |
| --- | --- | --- |
| `CHATBOT_ENABLED` | `false` | Off → `503 CHATBOT_UNAVAILABLE`. |
| `CHATBOT_LLM_BASE_URL` | empty | OpenAI-compatible base URL ending in `/v1`. |
| `CHATBOT_LLM_API_KEY` | empty | Bearer key (SecretStr, never logged); empty for local routers. |
| `CHATBOT_LLM_MODELS` | empty | Comma-separated fallback list, tried in order per step. |
| `CHATBOT_MCP_URL` | empty | Agentra MCP endpoint, e.g. `http://mcp:8100/mcp` in Compose. |
| `CHATBOT_LLM_TIMEOUT_SECONDS` | 20 | Per model request (also the MCP client timeout). |
| `CHATBOT_MAX_TOOL_STEPS` | 4 | LLM rounds per message (1–8). |
| `CHATBOT_DEADLINE_SECONDS` | 45 | Whole tool loop. |
| `CHATBOT_RATE_LIMIT` / `CHATBOT_RATE_WINDOW_SECONDS` | 20 / 60 | Per-user `chatbot` bucket. |

MCP server (`mcp-server/.env.example`): `AGENTRA_API_URL`, `MCP_HOST`, `MCP_PORT` (8100),
`MCP_PATH` (`/mcp`), `MCP_PUBLIC_URL`, `MCP_TOKEN_CACHE_SECONDS` (30),
`MCP_REQUEST_TIMEOUT_SECONDS` (20), `MCP_STARTUP_RETRIES` (10).

## Implementation

| Path | Role |
| --- | --- |
| `mcp-server/agentra_mcp/tools.py` | Wrapped operations, hints, `tool_name`, `select_operations`, permission rules. |
| `mcp-server/agentra_mcp/auth.py` | `AgentraTokenVerifier` (`/auth/me`, scopes = `allowedFunctions`). |
| `mcp-server/agentra_mcp/server.py` | `build_server` (`from_openapi`), `forward_token`, `PermissionFilter`, `/healthz`. |
| `backend/.../chatbot/mcp_client.py` | `connect` (fastmcp `Client`, Bearer), `McpTools` (OpenAI tool list, calls). |
| `backend/.../chatbot/llm.py` | `LLMClient`: async chat completions, `stream: false`, model fallback. |
| `backend/.../chatbot/orchestrator.py` | System prompt, loop, number scrub. |
| `backend/.../chatbot/tables.py` | Fixed table columns per tool. |
| `backend/.../chatbot/service.py`, `router.py`, `schemas.py`, `dependencies.py` | Admission, rate limit, HTTP operation. |

Tests: `mcp-server/tests/test_server.py` (13, offline, real contract, in-memory MCP calls)
and `backend/tests/chatbot/test_chatbot.py` (33, offline); `mcp-server` has 14 tests.

Runtime (15/11/2026): Docker Compose service `mcp` (`127.0.0.1:8100`). Provider: z.ai
free Flash models (`CHATBOT_LLM_BASE_URL=https://api.z.ai/api/paas/v4`, models
`glm-4.5-flash,glm-4.7-flash`, timeout 30 s, deadline 55 s; `glm-5.3-flash*` need a paid
balance). Measured: 15–40 s per answer, one 30 s timeout recovered by the fallback model.
Groq free (`openai/gpt-oss-120b/20b`) was faster (~1 s per round) but its 8K tokens/minute
per model allowed about one question per minute; a third quick question returned 429.
Production (15/11/2026): Vercel service `mcp` (root `mcp-server/`, entrypoint
`index:app` = `asgi_app()`, rewrites `/mcp`, `/mcp/*`,
`/.well-known/oauth-protected-resource*`) at https://agentra-dms.vercel.app/mcp; the
backend calls it at that URL. Environment uploaded with
`uv run python deploy_vercel_env.py --chatbot --environment production` (CHATBOT_*,
`CHATBOT_MCP_URL`, and `AGENTRA_API_URL`/`MCP_PUBLIC_URL`/`MCP_STARTUP_RETRIES` for the
mcp service; Vercel variables are project-wide). Verified: `/mcp` without a token → 401;
19 tools and `list_agencies` with a real token; two web questions answered in 12–15 s;
browser check of the assistant passes.

## Next

1. OAuth 2.1 for external clients (metadata, DCR, PKCE, consent; OAuth tables in a new
   migration). Only the MCP `TokenVerifier` changes; tools and backend stay as they are.
2. A faster or paid provider if 15–40 s answers are too slow.
