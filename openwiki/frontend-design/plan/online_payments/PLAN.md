# F26 — online_payments: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Initiate sandbox collection and reconcile only server-verified payment evidence. This module owns its feature under `ui/src/features/online_payments/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F24. **Backend gates:** M26. The rendered [module wireframe](../../wr/online_payments/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F26-SCR01 | [Thanh toán trực tuyến](../../wr/online_payments/index.html) | Find pending, success, failed and expired attempts. | Pending|Failed/expired|Late success |
| F26-SCR02 | [Tạo thanh toán](../../wr/online_payments/create.html) | Start one bounded intent against current debt and supported sandbox. | Unsupported provider|Amount exceeds debt|Uncertain setup |
| F26-SCR03 | [Mở trang thanh toán](../../wr/online_payments/checkout.html) | Present checkout only when server supplies a trusted URL. | 202 setup pending|URL unavailable|Return without proof |
| F26-SCR04 | [Chờ xác nhận từ cổng](../../wr/online_payments/return.html) | Browser return is not verified money; poll existing payment. | Still pending|Return failed|Reconcile |
| F26-SCR05 | [Kết quả thanh toán](../../wr/online_payments/detail.html) | Show full verified receipt and any excess dealer credit. | Late SUCCESS|Duplicate callback|Failed |
| F26-SCR06 | [Sự kiện thanh toán](../../wr/online_payments/events.html) | Read authorized normalized event summaries only. | Invalid signature hidden|Repeated event|No events |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listOnlinePayments` | GET `/online-payments` | (payments.online | debt.read) | — | M26/M26 | Owner | [Thanh toán trực tuyến](../../wr/online_payments/index.html) |
| `createOnlinePayment` | POST `/online-payments` | payments.online | Idempotency-Key | M26/M26 | Owner | [Tạo thanh toán](../../wr/online_payments/create.html) |
| `getOnlinePayment` | GET `/online-payments/{paymentId}` | (payments.online | debt.read) | — | M26/M26 | Owner | [Kết quả thanh toán](../../wr/online_payments/detail.html) |
| `listPaymentEvents` | GET `/online-payments/{paymentId}/events` | payments.online | — | M26/M26 | Owner | [Sự kiện thanh toán](../../wr/online_payments/events.html) |
| `reconcileOnlinePayment` | POST `/online-payments/{paymentId}/reconcile` | payments.online | Idempotency-Key | M26/M26 | Owner | [Kết quả thanh toán](../../wr/online_payments/detail.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

The provider webhook is server-to-server, not a frontend action; no return URL proves SUCCESS. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
