# F16 — stock_receipts: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Prepare and post incoming goods, then integrate full lines and later correction/cancellation. This module owns its feature under `ui/src/features/stock_receipts/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F15. **Backend gates:** M15/M28/M29. The rendered [module wireframe](../../wr/stock_receipts/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F16-SCR01 | [Phiếu nhập hàng](../../wr/stock_receipts/index.html) | Find drafts and posted receipts by business date/status. | No receipts|Canceled|Filtered |
| F16-SCR02 | [Lập phiếu nhập](../../wr/stock_receipts/editor.html) | Enter one product per line, quantity and positive purchase price. | Duplicate line|Inactive unit|Invalid price |
| F16-SCR03 | [Xác nhận nhập kho](../../wr/stock_receipts/review.html) | Review draft against latest version before authoritative posting. | 412|Historical stock dependency|Unknown result |
| F16-SCR04 | [Chi tiết phiếu nhập](../../wr/stock_receipts/detail.html) | Show committed stock changes and the historical purchase-price source. | Posted immutable|Corrected|Cancel blocked |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listStockReceipts` | GET `/stock-receipts` | (stock.receipt.prepare | stock.receipt.post | inventory.read) | — | M15/M15 | Owner | [Phiếu nhập hàng](../../wr/stock_receipts/index.html) |
| `createStockReceipt` | POST `/stock-receipts` | stock.receipt.prepare | Idempotency-Key | M15/M15 | Owner | [Lập phiếu nhập](../../wr/stock_receipts/editor.html) |
| `getStockReceipt` | GET `/stock-receipts/{documentId}` | (stock.receipt.prepare | stock.receipt.post | inventory.read) | — | M15/M15 | Owner | [Chi tiết phiếu nhập](../../wr/stock_receipts/detail.html) |
| `updateStockReceiptDraft` | PATCH `/stock-receipts/{documentId}` | stock.receipt.prepare | If-Match | M15/M15 | Owner | [Lập phiếu nhập](../../wr/stock_receipts/editor.html) |
| `postStockReceipt` | POST `/stock-receipts/{documentId}/post` | stock.receipt.post | If-Match, Idempotency-Key | M15/M15 | Owner | [Xác nhận nhập kho](../../wr/stock_receipts/review.html) |
| `correctStockReceipt` | POST `/stock-receipts/{documentId}/corrections` | documents.correct & stock.receipt.post | If-Match, Idempotency-Key | M29/M29 | Owner | [Chi tiết phiếu nhập](../../wr/stock_receipts/detail.html) |
| `cancelStockReceipt` | POST `/stock-receipts/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M15/M29 | Owner | [Chi tiết phiếu nhập](../../wr/stock_receipts/detail.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Receipt create-with-lines is distinct from later published shared line editing and full cancellation. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
