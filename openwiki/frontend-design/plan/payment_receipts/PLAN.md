# F18 — payment_receipts: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Post manual debt collections with server FIFO; generated and online receipts stay read-only here. This module owns its feature under `ui/src/features/payment_receipts/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F17. **Backend gates:** M18/M28/M29. The rendered [module wireframe](../../wr/payment_receipts/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F18-SCR01 | [Phiếu thu](../../wr/payment_receipts/index.html) | Find manual, automatic and online sources with method/status filters. | Generated read-only|Empty|Canceled |
| F18-SCR02 | [Lập phiếu thu công nợ](../../wr/payment_receipts/editor.html) | Choose same dealer, positive amount, method and business date. | Future invoice|Overcollection|Validation |
| F18-SCR03 | [Xác nhận tiền đã thu](../../wr/payment_receipts/review.html) | Review real cash evidence; allocation is automatic FIFO. | Insufficient eligible debt|412|Unknown result |
| F18-SCR04 | [Chi tiết phiếu thu](../../wr/payment_receipts/detail.html) | Show posted money and read-only allocations to issues. | Auto receipt immutable|Correction|Cancel blocked |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listPaymentReceipts` | GET `/payment-receipts` | (cash.receipt.prepare | cash.receipt.post | debt.read) | — | M18/M18 | Owner | [Phiếu thu](../../wr/payment_receipts/index.html) |
| `createPaymentReceipt` | POST `/payment-receipts` | cash.receipt.prepare | Idempotency-Key | M18/M18 | Owner | [Lập phiếu thu công nợ](../../wr/payment_receipts/editor.html) |
| `getPaymentReceipt` | GET `/payment-receipts/{documentId}` | (cash.receipt.prepare | cash.receipt.post | debt.read) | — | M18/M18 | Owner | [Chi tiết phiếu thu](../../wr/payment_receipts/detail.html) |
| `updatePaymentReceiptDraft` | PATCH `/payment-receipts/{documentId}` | cash.receipt.prepare | If-Match | M18/M18 | Owner | [Lập phiếu thu công nợ](../../wr/payment_receipts/editor.html) |
| `postPaymentReceipt` | POST `/payment-receipts/{documentId}/post` | cash.receipt.post | If-Match, Idempotency-Key | M18/M18 | Owner | [Xác nhận tiền đã thu](../../wr/payment_receipts/review.html) |
| `correctPaymentReceipt` | POST `/payment-receipts/{documentId}/corrections` | documents.correct & cash.receipt.post | If-Match, Idempotency-Key | M29/M29 | Owner | [Chi tiết phiếu thu](../../wr/payment_receipts/detail.html) |
| `cancelPaymentReceipt` | POST `/payment-receipts/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M18/M29 | Owner | [Chi tiết phiếu thu](../../wr/payment_receipts/detail.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Never offer manual selection or mutation of invoice allocations. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
