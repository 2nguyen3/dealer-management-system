# F27 — refunds: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Return actual money from a single source receipt while preserving reservation and attempt evidence. This module owns its feature under `ui/src/features/refunds/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F25, F26. **Backend gates:** M27. The rendered [module wireframe](../../wr/refunds/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F27-SCR01 | [Hoàn tiền](../../wr/refunds/index.html) | Find document status and independent attempt status. | DRAFT yet reserved|UNKNOWN|Paid |
| F27-SCR02 | [Lập yêu cầu hoàn](../../wr/refunds/editor.html) | Select one eligible original receipt, amount and method. | Two sources need two refunds|Source exhausted|Insufficient credit |
| F27-SCR03 | [Dành dư có để hoàn](../../wr/refunds/review.html) | Reserve available funds before manual or provider payout. | Race with offset|Missing permission|412 |
| F27-SCR04 | [Chi tiết phiếu hoàn](../../wr/refunds/detail.html) | Show paid, reserved, attempt and document states independently. | DRAFT noneditable|Paid immutable|Safe cancel |
| F27-SCR05 | [Lần thử hoàn trực tuyến](../../wr/refunds/attempt.html) | Inspect PENDING, UNKNOWN, FAILED or SUCCESS with reconciliation. | UNKNOWN retains reservation|Timeout|Verified failure |
| F27-SCR06 | [Xác nhận đã hoàn tiền](../../wr/refunds/confirm-paid.html) | Confirm observed cash/bank payout before committing financial effect. | Unpaid|Double confirmation|Wrong source |
| F27-SCR07 | [Tạo lần thử mới](../../wr/refunds/retry.html) | Only after verified failure and released reservation, form a fresh attempt. | UNKNOWN blocks retry|New revision|No second payout |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listRefunds` | GET `/refunds` | (cash.refund.prepare | cash.refund.post | debt.read) | — | M27/M27 | Owner | [Hoàn tiền](../../wr/refunds/index.html) |
| `createRefund` | POST `/refunds` | cash.refund.prepare | Idempotency-Key | M27/M27 | Owner | [Lập yêu cầu hoàn](../../wr/refunds/editor.html) |
| `getRefund` | GET `/refunds/{documentId}` | (cash.refund.prepare | cash.refund.post | debt.read) | — | M27/M27 | Owner | [Chi tiết phiếu hoàn](../../wr/refunds/detail.html) |
| `updateRefundDraft` | PATCH `/refunds/{documentId}` | cash.refund.prepare | If-Match | M27/M27 | Owner | [Lập yêu cầu hoàn](../../wr/refunds/editor.html) |
| `submitRefund` | POST `/refunds/{documentId}/submit` | cash.refund.post | If-Match, Idempotency-Key | M27/M27 | Owner | [Dành dư có để hoàn](../../wr/refunds/review.html) |
| `confirmManualRefundPaid` | POST `/refunds/{documentId}/confirm-paid` | cash.refund.post | If-Match, Idempotency-Key | M27/M27 | Owner | [Xác nhận đã hoàn tiền](../../wr/refunds/confirm-paid.html) |
| `cancelUnpaidRefund` | POST `/refunds/{documentId}/cancel` | documents.cancel & cash.refund.post | If-Match, Idempotency-Key | M27/M27 | Owner | [Chi tiết phiếu hoàn](../../wr/refunds/detail.html) |
| `listRefundAttempts` | GET `/refunds/{documentId}/attempts` | (cash.refund.post | debt.read) | — | M27/M27 | Owner | [Lần thử hoàn trực tuyến](../../wr/refunds/attempt.html) |
| `requestOnlineRefund` | POST `/refunds/{documentId}/attempts` | cash.refund.post | If-Match, Idempotency-Key | M27/M27 | Owner | [Lần thử hoàn trực tuyến](../../wr/refunds/attempt.html) |
| `getRefundAttempt` | GET `/refund-attempts/{attemptId}` | (cash.refund.post | debt.read) | — | M27/M27 | Owner | [Lần thử hoàn trực tuyến](../../wr/refunds/attempt.html) |
| `reconcileRefundAttempt` | POST `/refund-attempts/{attemptId}/reconcile` | cash.refund.post | Idempotency-Key | M27/M27 | Owner | [Lần thử hoàn trực tuyến](../../wr/refunds/attempt.html) |
| `listRefundReservations` | GET `/refunds/{documentId}/reservations` | (cash.refund.post | debt.read) | — | M27/M27 | Owner | [Chi tiết phiếu hoàn](../../wr/refunds/detail.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

UNKNOWN keeps credit reserved; the source requestOnlineRefund operation has no reason body. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
