# F23 — sales_returns: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Receive actual goods against a posted sale at original price, reducing debt and/or creating credit. This module owns its feature under `ui/src/features/sales_returns/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F20. **Backend gates:** M23/M28/M29. The rendered [module wireframe](../../wr/sales_returns/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F23-SCR01 | [Hàng trả lại](../../wr/sales_returns/index.html) | Search posted return events and their originating sale. | No returns|Partial|Corrected |
| F23-SCR02 | [Chọn phiếu xuất gốc](../../wr/sales_returns/source.html) | Inspect originally sold and already returned quantities by line. | Origin not POSTED|Fully returned|No access |
| F23-SCR03 | [Ghi nhận hàng trả](../../wr/sales_returns/editor.html) | Enter actual received quantities with preserved original price. | Over-return|Zero monetary rounded line|Invalid fraction |
| F23-SCR04 | [Xác nhận nhận hàng](../../wr/sales_returns/review.html) | Explain stock increase, debt reduction and separate new credit. | No automatic refund|Dependent blocker|412 |
| F23-SCR05 | [Chi tiết phiếu trả](../../wr/sales_returns/detail.html) | Show real return date, origin and linked financial effects. | Partial history|Correction|Zero-value line |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listSalesReturns` | GET `/sales-returns` | (returns.prepare | returns.post | debt.read | sales.read) | — | M23/M23 | Owner | [Hàng trả lại](../../wr/sales_returns/index.html) |
| `createSalesReturn` | POST `/sales-returns` | returns.prepare | Idempotency-Key | M23/M23 | Owner | [Ghi nhận hàng trả](../../wr/sales_returns/editor.html) |
| `getSalesReturn` | GET `/sales-returns/{documentId}` | (returns.prepare | returns.post | debt.read | sales.read) | — | M23/M23 | Owner | [Chi tiết phiếu trả](../../wr/sales_returns/detail.html) |
| `updateSalesReturnDraft` | PATCH `/sales-returns/{documentId}` | returns.prepare | If-Match | M23/M23 | Owner | [Ghi nhận hàng trả](../../wr/sales_returns/editor.html) |
| `postSalesReturn` | POST `/sales-returns/{documentId}/post` | returns.post | If-Match, Idempotency-Key | M23/M23 | Owner | [Xác nhận nhận hàng](../../wr/sales_returns/review.html) |
| `correctSalesReturn` | POST `/sales-returns/{documentId}/corrections` | documents.correct & returns.post | If-Match, Idempotency-Key | M29/M29 | Owner | [Chi tiết phiếu trả](../../wr/sales_returns/detail.html) |
| `cancelSalesReturn` | POST `/sales-returns/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M23/M29 | Owner | [Chi tiết phiếu trả](../../wr/sales_returns/detail.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

A valid zero-VND line still changes returned quantity and inventory. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
