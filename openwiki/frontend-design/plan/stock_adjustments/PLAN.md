# F21 — stock_adjustments: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Post independent signed stock changes with a reason; count-generated adjustments are immutable. This module owns its feature under `ui/src/features/stock_adjustments/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F16. **Backend gates:** M21/M28/M29. The rendered [module wireframe](../../wr/stock_adjustments/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F21-SCR01 | [Điều chỉnh tồn](../../wr/stock_adjustments/index.html) | Search independent and count-generated adjustments. | Count generated read-only|No results|Cancelled |
| F21-SCR02 | [Lập phiếu điều chỉnh](../../wr/stock_adjustments/editor.html) | Enter nonzero signed quantity; no sale or monetary fields. | Zero delta|Historical negative stock|Unit precision |
| F21-SCR03 | [Xác nhận điều chỉnh](../../wr/stock_adjustments/review.html) | Check affected products and server-authoritative new balance. | Permission denied|412|Historical blocker |
| F21-SCR04 | [Chi tiết điều chỉnh](../../wr/stock_adjustments/detail.html) | Link to count if generated and show no monetary effects. | Confirmed count immutable|Corrected independent|Cancelled |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listStockAdjustments` | GET `/stock-adjustments` | (stock.adjustment.prepare | stock.adjustment.post | inventory.read) | — | M21/M21 | Owner | [Điều chỉnh tồn](../../wr/stock_adjustments/index.html) |
| `createStockAdjustment` | POST `/stock-adjustments` | stock.adjustment.prepare | Idempotency-Key | M21/M21 | Owner | [Lập phiếu điều chỉnh](../../wr/stock_adjustments/editor.html) |
| `getStockAdjustment` | GET `/stock-adjustments/{documentId}` | (stock.adjustment.prepare | stock.adjustment.post | inventory.read) | — | M21/M21 | Owner | [Chi tiết điều chỉnh](../../wr/stock_adjustments/detail.html) |
| `updateStockAdjustmentDraft` | PATCH `/stock-adjustments/{documentId}` | stock.adjustment.prepare | If-Match | M21/M21 | Owner | [Lập phiếu điều chỉnh](../../wr/stock_adjustments/editor.html) |
| `postStockAdjustment` | POST `/stock-adjustments/{documentId}/post` | stock.adjustment.post | If-Match, Idempotency-Key | M21/M21 | Owner | [Xác nhận điều chỉnh](../../wr/stock_adjustments/review.html) |
| `correctStockAdjustment` | POST `/stock-adjustments/{documentId}/corrections` | documents.correct & stock.adjustment.post | If-Match, Idempotency-Key | M29/M29 | Owner | [Chi tiết điều chỉnh](../../wr/stock_adjustments/detail.html) |
| `cancelStockAdjustment` | POST `/stock-adjustments/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M21/M29 | Owner | [Chi tiết điều chỉnh](../../wr/stock_adjustments/detail.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Adjustments do not create sales or change purchase-price source. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
