# F17 — stock_issues: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Prepare sale, freeze READY price and post physical issue with correct upfront evidence and current checks. This module owns its feature under `ui/src/features/stock_issues/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F16. **Backend gates:** M17/M19/M28/M29. The rendered [module wireframe](../../wr/stock_issues/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F17-SCR01 | [Phiếu xuất hàng](../../wr/stock_issues/index.html) | Queue drafts, waiting issues and posted sales. | No permission|Pending|Canceled |
| F17-SCR02 | [Lập phiếu xuất](../../wr/stock_issues/editor.html) | Select active dealer and products; draft quote remains provisional. | No price source|Invalid amount|Dealer terminated |
| F17-SCR03 | [Chờ xuất kho](../../wr/stock_issues/pending.html) | Display frozen READY price, verification and stock-not-reserved warning. | No verification|Stock consumed|Credit limit |
| F17-SCR04 | [Thay nội dung chờ xuất](../../wr/stock_issues/replace-pending.html) | Replace pending revision; previous evidence may require separation. | Verified money blocks replacement|New draft|412 |
| F17-SCR05 | [Xác nhận xuất kho](../../wr/stock_issues/review.html) | Recheck warehouse stock, dealer and limit; one result with auto receipt. | Money retained after failed post|No stock|Uncertain result |
| F17-SCR06 | [Chi tiết phiếu xuất](../../wr/stock_issues/detail.html) | Separate remaining at issue from current outstanding and linked receipts. | Return linked|Corrected|Paid by credit |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listStockIssues` | GET `/stock-issues` | (stock.issue.prepare | stock.issue.post | debt.read | sales.read) | — | M17/M17 | Owner | [Phiếu xuất hàng](../../wr/stock_issues/index.html) |
| `createStockIssue` | POST `/stock-issues` | stock.issue.prepare | Idempotency-Key | M17/M17 | Owner | [Lập phiếu xuất](../../wr/stock_issues/editor.html) |
| `getStockIssue` | GET `/stock-issues/{documentId}` | (stock.issue.prepare | stock.issue.post | debt.read | sales.read) | — | M17/M17 | Owner | [Chi tiết phiếu xuất](../../wr/stock_issues/detail.html) |
| `updateStockIssueDraft` | PATCH `/stock-issues/{documentId}` | stock.issue.prepare | If-Match | M17/M17 | Owner | [Lập phiếu xuất](../../wr/stock_issues/editor.html) |
| `submitStockIssue` | POST `/stock-issues/{documentId}/submit` | stock.issue.prepare | If-Match, Idempotency-Key | M17/M17 | Owner | [Xác nhận xuất kho](../../wr/stock_issues/review.html) |
| `replacePendingStockIssue` | POST `/stock-issues/{documentId}/revisions` | stock.issue.prepare | If-Match, Idempotency-Key | M17/M19 | Owner | [Lập phiếu xuất](../../wr/stock_issues/editor.html) |
| `postStockIssue` | POST `/stock-issues/{documentId}/post` | stock.issue.post | If-Match, Idempotency-Key | M17/M19 | Owner | [Xác nhận xuất kho](../../wr/stock_issues/review.html) |
| `correctStockIssue` | POST `/stock-issues/{documentId}/corrections` | documents.correct & stock.issue.post | If-Match, Idempotency-Key | M29/M29 | Owner | [Chi tiết phiếu xuất](../../wr/stock_issues/detail.html) |
| `cancelStockIssue` | POST `/stock-issues/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M17/M29 | Owner | [Chi tiết phiếu xuất](../../wr/stock_issues/detail.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Issue post/pending replacement are full-gated at M19; cancel at M29; no READY stock reservation. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
