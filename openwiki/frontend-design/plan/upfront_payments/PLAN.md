# F19 — upfront_payments: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Verify received upfront cash for the exact READY issue revision; recognize stranded money separately. This module owns its feature under `ui/src/features/upfront_payments/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F18. **Backend gates:** M19. The rendered [module wireframe](../../wr/upfront_payments/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F19-SCR01 | [Khoản trả ngay](../../wr/upfront_payments/index.html) | Show waiting verification and VERIFIED-but-unreceipted work. | Waiting|Verified unreceipted|Consumed |
| F19-SCR02 | [Xác nhận tiền trả ngay](../../wr/upfront_payments/verify.html) | Record evidence, actual receipt instant, method and matching revision. | Wrong revision|No actual money|Permission denied |
| F19-SCR03 | [Chi tiết xác nhận](../../wr/upfront_payments/detail.html) | Trace one evidence item to auto receipt or separate receipt. | VERIFIED|CONSUMED|RECEIVED_SEPARATELY |
| F19-SCR04 | [Ghi nhận tiền riêng](../../wr/upfront_payments/receive-separately.html) | Handle verified money when delivery fails; issue remains a separate task. | Issue blocked|Already consumed|Uncertain result |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listUpfrontConfirmations` | GET `/upfront-confirmations` | (cash.upfront.verify | cash.receipt.post | stock.issue.post) | — | M19/M19 | Owner | [Khoản trả ngay](../../wr/upfront_payments/index.html) |
| `verifyUpfrontPayment` | POST `/upfront-confirmations` | cash.upfront.verify | Idempotency-Key | M19/M19 | Owner | [Xác nhận tiền trả ngay](../../wr/upfront_payments/verify.html) |
| `getUpfrontConfirmation` | GET `/upfront-confirmations/{confirmationId}` | (cash.upfront.verify | cash.receipt.post | stock.issue.post) | — | M19/M19 | Owner | [Chi tiết xác nhận](../../wr/upfront_payments/detail.html) |
| `receiveUpfrontSeparately` | POST `/upfront-confirmations/{confirmationId}/receive-separately` | cash.receipt.post | If-Match, Idempotency-Key | M19/M19 | Owner | [Ghi nhận tiền riêng](../../wr/upfront_payments/receive-separately.html) |
| `getStockIssue` | GET `/stock-issues/{documentId}` | (stock.issue.prepare | stock.issue.post | debt.read | sales.read) | — | M17/M17 | Consumer | [Chi tiết xác nhận](../../wr/upfront_payments/detail.html) |
| `replacePendingStockIssue` | POST `/stock-issues/{documentId}/revisions` | stock.issue.prepare | If-Match, Idempotency-Key | M17/M19 | Consumer | [Chi tiết xác nhận](../../wr/upfront_payments/detail.html) |
| `postStockIssue` | POST `/stock-issues/{documentId}/post` | stock.issue.post | If-Match, Idempotency-Key | M17/M19 | Consumer | [Chi tiết xác nhận](../../wr/upfront_payments/detail.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

VERIFIED is not a posted receipt; failed shipment must not make cash disappear. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
