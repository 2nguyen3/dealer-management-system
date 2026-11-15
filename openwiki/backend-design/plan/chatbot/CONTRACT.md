# M32 Chatbot Contract

Revised: 2026-11-15, after the 14/11/2026 simplification. Status: phase 1 implemented
15/11/2026 (`backend/app/modules/chatbot/`, operation `sendChatbotMessage`); the web UI
(floating assistant, `ui/src/features/chatbot/`) calls it. Phase 2 (public MCP + OAuth)
is not started. See [Implementation (phase 1)](#implementation-phase-1).

This revision supersedes the fixed-slot `POST /chatbot/queries` (`queryChatbot`),
decision [D10](../full_backend/DECISIONS.md) (candidate paging through `/agencies`) and
the F32 page plans under `openwiki/frontend-design/plan/chatbot/`. The architecture
draft of 13/11 (`tmp/kien-truc-chatbot.html`) remains the rationale; the corrections
below take precedence over it.

## Files

| File | Role |
| --- | --- |
| [chatbot.openapi.yaml](chatbot.openapi.yaml) | Design-first HTTP contract of `sendChatbotMessage` (`POST /chatbot/messages`). |
| `API/openapi.json` | Generated from the runtime app: 92 operations including `sendChatbotMessage`. |
| this file | Semantic model, permissions, MCP tools, settings and decisions. |

## Architecture (unchanged direction)

```text
Web assistant (React, floating) ──HTTPS + session JWT──▶ POST /chatbot/messages
                                                         │ orchestrator: LLM tool loop ≤ 4 steps
Claude / Cursor / agents ──MCP + OAuth (phase 2)──▶ /mcp │
                                                         ▼
                         SemanticQueryEngine (pure Python: semantic model, validator,
                         per-metric RBAC, QĐ16 policy, entity resolver)
                                                         ▼
                         agency.debt / product.stock / ReportService SQL (reports/queries.py)
```

The web assistant is an in-process MCP client: the orchestrator lists and calls the
same four tools the MCP server exposes, so both paths share validation and RBAC.

## Corrections to the 13/11 draft

| # | Draft | Now |
| --- | --- | --- |
| C1 | INVENTORY needs `inventory.read` | That code was retired. Current stock follows the product list policy (anyOf below). |
| C2 | Reuse the report routes' permissions | `/reports/*` require `reports.read` **and** `debt.read`/`sales.read`; SALES and WAREHOUSE groups lack `reports.read`. The engine calls the report SQL directly with its own per-metric policy so sales staff can ask. |
| C3 | DEBT lineage `receivable_entry`, "after returns and offsets" | Removed tables. Debt = POSTED stock issues − POSTED payment receipts; the current balance is `agency.debt`. |
| C4 | OAuth tables in migration 0011 | 0011 is the simplified schema; OAuth tables go to **0012** (phase 2). |
| C5 | Two reply statuses | Four: `ANSWERED`, `NEEDS_SELECTION`, `NEEDS_INFO`, `REFUSED`, plus `resume` so picking a candidate costs no LLM call. |
| C6 | Columns carry labels | Columns carry `key` + `type`; the UI translates labels (24 locales). `answer`/`title` follow `locale`. |
| C7 | Table links to UI paths | `source` names the read operation (`operationId` + query) that shows the same figures. |

## Semantic model (D3)

Periods are half-open `[fromDate, toDate)`, as in the reports. Money, quantity and rate
are exact decimal strings. `limit` is 1–50 (default 20); `filters` ≤ 5.

| Metric | Period | Grain | Reader | Permission | Filter fields (op) | Sorts | Columns |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DEBT | omitted | agency | `agency.debt` | `debt.read` | agency, ward, agencyType (eq); debt (gt/gte/lt/lte) | debt, agencyCode | agencyCode, agencyName, wardName, debt |
| DEBT | given | agency | report `debt` | `debt.read` | agency, ward, agencyType (eq); closingDebt (cmp) | closingDebt, debtIncrease, agencyCode | agencyCode, agencyName, openingDebt, debtIncrease, paidAmount, closingDebt |
| INVENTORY | omitted | product | `product.stock` | product readers¹ | product (eq); stock (cmp) | stock, productCode | productCode, productName, unitName, stock |
| INVENTORY | given | product | report `inventory` | `reports.read` | product (eq); closingStock (cmp) | closingStock, productCode | productCode, productName, unitName, openingStock, receiptQuantity, issueQuantity, closingStock |
| SALES (`groupBy=agency`) | **required** | agency | report `sales` | `sales.read` | agency, agencyType (eq); salesAmount (cmp) | salesAmount, numberOfIssues, agencyCode | agencyCode, agencyName, numberOfIssues, salesAmount, salesRate |
| SALES (`groupBy=product`) | **required** | product | report `product-sales` | `sales.read` | agency, product (eq); salesAmount (cmp) | salesAmount, soldQuantity, productCode | productCode, productName, unitName, numberOfIssues, soldQuantity, salesAmount |

¹ Product readers = anyOf `product.manage`, `stock.receipt.prepare`, `stock.receipt.post`,
`stock.issue.prepare`, `stock.issue.post`, `sales.read`, `reports.read` (same as `listProducts`).
The endpoint's anyOf in the YAML is the union of all metric permissions.

Source mapping: DEBT current → `listAgencies`, DEBT period → `getDebtReport`, INVENTORY
current → `listProducts`, INVENTORY period → `getInventoryReport`, SALES →
`getSalesReport` / `getProductSalesReport`.

Entity resolution: `agency` and `product` match an exact code first, then names that
contain every word of the query (accent- and case-insensitive, `đ` = `d`); one exact
product name wins over longer ones, duplicate agency names always ask. One match → run; several → `NEEDS_SELECTION` with ≤ 10 candidates
`{code, name, detail}` (ward / unit), no balances; none → `REFUSED` `NO_MATCH`.

## QĐ16 mapping

| Step | Where |
| --- | --- |
| B1 receive question | `POST /chatbot/messages` (web) or the client's own LLM (MCP). |
| B3 read the semantic model | `semantic_model.py` (frozen dataclasses); `describe_semantic_model` filtered by the caller's permissions. |
| B4 interpret | LLM chooses `query_metric` arguments. |
| B5 scope, permission, completeness | Engine: whitelist → `REFUSED UNSUPPORTED_QUERY`; RBAC → `REFUSED FORBIDDEN_METRIC`; missing slot → `NEEDS_INFO`. |
| B6 query; duplicate names → list | Resolver → `NEEDS_SELECTION`; the answer is accepted again only by code (`resume.select`). |
| B7 return result | `ANSWERED` with tables copied from the engine. |

## MCP tools (same engine)

| Tool | Input | Output | Permission |
| --- | --- | --- | --- |
| `describe_semantic_model` (+ resource `dms://semantic-model`) | — | metrics/fields/ops the caller may use | authenticated |
| `find_agencies` | `query` | ≤ 10 `{code, name, ward}`, `totalMatches` | `debt.read` or `sales.read` |
| `find_products` | `query` | ≤ 10 `{code, name, unit}` | product readers |
| `query_metric` | `SemanticQuery` | `ChatbotTable` or structured error | per metric |

Structured tool errors: `MISSING_FIELD`, `AMBIGUOUS_ENTITY` (with candidates),
`FORBIDDEN_METRIC`, `UNSUPPORTED_FIELD`, `INVALID_OPERATOR`, `UNSUPPORTED_QUERY`,
`NO_MATCH`. All tools carry `readOnlyHint`; none writes business data.

The web orchestrator adds two loop-only tools that never reach MCP: `ask_user`
(`question`, `missing[]` → `NEEDS_INFO`) and `report_unsupported` (→ `REFUSED
UNSUPPORTED_QUERY`).

## HTTP errors

`400/422 VALIDATION_FAILED` (schema, reversed period, `limit` > 50, last turn not from the
user without `resume`, a `resume` query that no longer validates), `401`, `415`, `403 FORBIDDEN`
(no metric permission at all), `429 RATE_LIMIT_EXCEEDED` (per-user `chatbot` bucket,
`Retry-After`), `503 CHATBOT_UNAVAILABLE` (disabled, all models failed, loop timeout).
A forbidden or unsupported question inside an allowed request is a `200 REFUSED`, not an
HTTP error, so the conversation continues.

## Safety rules

- Figures shown to the user come from `tables`, never from model text; numbers in
  `answer` that are absent from tool results are stripped.
- At most 50 rows per table and no contact data reach the provider. The provider sees
  query results; this is an accepted change to the earlier "no financial data to the
  provider" assumption (user decision 13/11/2026).
- Phase 1 logs (logger `app.chatbot`) the user id, tool names with error codes, reply
  status, model and duration; never the question, the answer or results. A durable
  `audit_log` entry is deferred to phase 2 because the endpoint writes nothing.
- No database connection is held while the model thinks: authentication runs in one
  short read-only transaction and every tool call opens its own read-only
  REPEATABLE READ snapshot.
- Provider key only in backend settings; never logged.

## Settings (backend `.env`, Vercel secrets)

Provider-neutral names (any OpenAI-compatible `/chat/completions` endpoint with tool
calling, e.g. OpenRouter `https://openrouter.ai/api/v1` or a local router):

| Variable | Default | Meaning |
| --- | --- | --- |
| `CHATBOT_ENABLED` | `false` | Off → `503 CHATBOT_UNAVAILABLE`. |
| `CHATBOT_LLM_BASE_URL` | empty | Base URL ending in `/v1`; empty → unavailable. |
| `CHATBOT_LLM_API_KEY` | empty | Bearer key (SecretStr, never logged); empty for local routers. |
| `CHATBOT_LLM_MODELS` | empty | Comma-separated fallback list, tried in order per step. |
| `CHATBOT_LLM_TIMEOUT_SECONDS` | 20 | Per model request. |
| `CHATBOT_MAX_TOOL_STEPS` | 4 | LLM rounds per message (1–8). |
| `CHATBOT_DEADLINE_SECONDS` | 45 | Whole tool loop. |
| `CHATBOT_RATE_LIMIT` / `CHATBOT_RATE_WINDOW_SECONDS` | 20 / 60 | Per-user `chatbot` bucket. |

Phase 2 adds `MCP_RESOURCE_URL` and `OAUTH_ACCESS_TOKEN_TTL_SECONDS`.

## Phases

1. Engine + in-process MCP tools + `POST /chatbot/messages` + orchestrator (this contract).
2. OAuth 2.1 (PKCE, DCR, migration 0012) and the public `/mcp` endpoint for Claude,
   Cursor and other agents, after a Vercel serverless spike.

## Web UI behaviour (implemented 15/11/2026)

- The assistant is a floating companion in the shell, not a sidebar route; `/chatbot`
  was removed. It is shown to users with at least one metric permission and can be
  hidden from its menu or **Hồ sơ → Giao diện**.
- Unknown routes (`404`) and `503 CHATBOT_UNAVAILABLE` render "not deployed / unavailable"
  without fabricating an answer. `resume` is sent when the user clicks a candidate.

## Implementation (phase 1)

Module `backend/app/modules/chatbot/`:

| File | Role |
| --- | --- |
| `semantic_model.py` | Variants of the table above, `ADMISSION`, `PRODUCT_READERS`. |
| `engine.py` | `SemanticQueryEngine` (`describe`, `find`, `query`), `ToolError`, entity matching. |
| `repository.py` | Read-only lookups and `ReportQueries` (the same SQL as the reports). |
| `llm.py` | `LLMClient`: OpenAI-compatible chat completions, `stream: false`, model fallback. |
| `orchestrator.py` | System prompt, tools, loop, status mapping, number scrub, `pendingQuery`. |
| `service.py`, `dependencies.py`, `router.py`, `schemas.py` | HTTP operation, admission, rate limit. |

Tests: `backend/tests/chatbot/test_chatbot.py` (offline, exact 100% statements/branches of
the module). No PostgreSQL integration suite yet; the engine reuses report SQL already
covered by the reports suites.

Runtime (15/11/2026): local Docker uses a temporary local OpenAI-compatible router on the
host (`CHATBOT_LLM_BASE_URL=http://host.docker.internal:20128/v1`, Compose maps
`host.docker.internal` via `extra_hosts`; models `ag/gemini-3-flash`, `cx/gpt-6-luna`).
Vercel production cannot reach that router, so `CHATBOT_ENABLED` stays unset there and
the UI shows "unavailable" until a hosted provider key (e.g. OpenRouter) is configured.
