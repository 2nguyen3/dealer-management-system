# F22 — stock_counts: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Capture book/last-entry snapshot, record physical observations and reconcile stale counts. This module owns its feature under `ui/src/features/stock_counts/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F21. **Backend gates:** M22. The rendered [module wireframe](../../wr/stock_counts/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F22-SCR01 | [Kiểm kê kho](../../wr/stock_counts/index.html) | Find draft and confirmed counts. | No counts|Confirmed immutable|Filtered |
| F22-SCR02 | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) | Enter physical observed quantity beside captured book quantity. | Zero difference retained|Stale snapshot|Invalid fraction |
| F22-SCR03 | [Xác nhận kiểm kê](../../wr/stock_counts/review.html) | Require extra adjustment-post grant only when any difference is nonzero. | Missing extra grant|Stale movement|No adjustment for zero |
| F22-SCR04 | [Đếm lại sau biến động](../../wr/stock_counts/recount.html) | New physical observations for every existing product, not silent rebasing. | Same final stock yet stale|Incomplete recount|412 |
| F22-SCR05 | [Biên bản kiểm kê](../../wr/stock_counts/detail.html) | Show immutable observations and generated adjustment link. | Zero-difference|Confirmed|No deletion |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listStockCounts` | GET `/stock-counts` | stock.count | — | M22/M22 | Owner | [Kiểm kê kho](../../wr/stock_counts/index.html) |
| `createStockCount` | POST `/stock-counts` | stock.count | Idempotency-Key | M22/M22 | Owner | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `getStockCount` | GET `/stock-counts/{countId}` | stock.count | — | M22/M22 | Owner | [Biên bản kiểm kê](../../wr/stock_counts/detail.html) |
| `updateStockCountDraft` | PATCH `/stock-counts/{countId}` | stock.count | If-Match | M22/M22 | Owner | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `listStockCountLines` | GET `/stock-counts/{countId}/lines` | stock.count | — | M22/M22 | Owner | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `createStockCountLine` | POST `/stock-counts/{countId}/lines` | stock.count | If-Match, Idempotency-Key | M22/M22 | Owner | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `getStockCountLine` | GET `/stock-counts/{countId}/lines/{lineId}` | stock.count | — | M22/M22 | Owner | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `updateStockCountLine` | PATCH `/stock-counts/{countId}/lines/{lineId}` | stock.count | If-Match | M22/M22 | Owner | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `recountStock` | POST `/stock-counts/{countId}/recount` | stock.count | If-Match, Idempotency-Key | M22/M22 | Owner | [Đếm lại sau biến động](../../wr/stock_counts/recount.html) |
| `confirmStockCount` | POST `/stock-counts/{countId}/confirm` | stock.count | If-Match, Idempotency-Key | M22/M22 | Owner | [Xác nhận kiểm kê](../../wr/stock_counts/review.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

An intervening movement is stale even if the quantity returns to its original value. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
