# F29 — document_corrections: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Coordinate full replacement and cancellation within six owning document types, preserving money and history. This module owns its feature under `ui/src/features/document_corrections/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F28. **Backend gates:** M29. The rendered [module wireframe](../../wr/document_corrections/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F29-SCR01 | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) | Choose a source document and correct-vs-real-event path. | Not a return|Not a refund|No generic endpoint |
| F29-SCR02 | [Sửa phiếu nhập](../../wr/document_corrections/stock-receipt.html) | Recheck every historical stock checkpoint and price-source dependency. | Past stock negative|New price source|Cancel blocked |
| F29-SCR03 | [Sửa phiếu xuất](../../wr/document_corrections/stock-issue.html) | Preserve real upfront money, return dependencies and FIFO. | Separate received money|Return affected|Debt limit |
| F29-SCR04 | [Sửa phiếu thu](../../wr/document_corrections/payment-receipt.html) | Replay valid allocations without erasing actual cash. | Insufficient future debt|FIFO replay|No fake refund |
| F29-SCR05 | [Sửa điều chỉnh kho](../../wr/document_corrections/stock-adjustment.html) | Correct only independent adjustments, not confirmed-count evidence. | Count-generated immutable|Historical stock|412 |
| F29-SCR06 | [Sửa phiếu trả](../../wr/document_corrections/sales-return.html) | Preserve actual return-versus-recording distinction and later credit sources. | Paid refund source|Over-return|Later rounding |
| F29-SCR07 | [Sửa phiếu bù trừ](../../wr/document_corrections/credit-application.html) | Protect reserved, refunded and reused credit lots. | Reserved credit|Paid refund|FIFO blockers |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `correctStockReceipt` | POST `/stock-receipts/{documentId}/corrections` | documents.correct & stock.receipt.post | If-Match, Idempotency-Key | M29/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `cancelStockReceipt` | POST `/stock-receipts/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M15/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `correctStockIssue` | POST `/stock-issues/{documentId}/corrections` | documents.correct & stock.issue.post | If-Match, Idempotency-Key | M29/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `cancelStockIssue` | POST `/stock-issues/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M17/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `correctPaymentReceipt` | POST `/payment-receipts/{documentId}/corrections` | documents.correct & cash.receipt.post | If-Match, Idempotency-Key | M29/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `cancelPaymentReceipt` | POST `/payment-receipts/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M18/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `correctStockAdjustment` | POST `/stock-adjustments/{documentId}/corrections` | documents.correct & stock.adjustment.post | If-Match, Idempotency-Key | M29/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `cancelStockAdjustment` | POST `/stock-adjustments/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M21/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `correctSalesReturn` | POST `/sales-returns/{documentId}/corrections` | documents.correct & returns.post | If-Match, Idempotency-Key | M29/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `cancelSalesReturn` | POST `/sales-returns/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M23/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `correctCreditApplication` | POST `/credit-applications/{documentId}/corrections` | documents.correct & credit.apply | If-Match, Idempotency-Key | M29/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `cancelCreditApplication` | POST `/credit-applications/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M25/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Every correction/cancel retains its owning API route and needs documents.correct plus owning post rights where specified. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
