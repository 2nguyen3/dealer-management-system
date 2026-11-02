# F25 — credit_applications: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Apply available same-dealer credit to eligible debt with server FIFO and no new cash. This module owns its feature under `ui/src/features/credit_applications/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F24. **Backend gates:** M25/M28/M29. The rendered [module wireframe](../../wr/credit_applications/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F25-SCR01 | [Bù trừ dư có](../../wr/credit_applications/index.html) | Search application drafts and posted offsets. | No applications|Cancelled|Read-only |
| F25-SCR02 | [Lập phiếu bù trừ](../../wr/credit_applications/editor.html) | Choose dealer, date and amount only within unreserved credit/debt. | Reserved funds|Insufficient debt|Validation |
| F25-SCR03 | [Xác nhận bù trừ](../../wr/credit_applications/review.html) | Review available sources and FIFO result without creating a receipt. | Credit race|412|No cash |
| F25-SCR04 | [Chi tiết bù trừ](../../wr/credit_applications/detail.html) | Trace consumed lots and settled issues. | Corrected|Source reserved|Posted immutable |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listCreditApplications` | GET `/credit-applications` | (credit.apply | debt.read) | — | M25/M25 | Owner | [Bù trừ dư có](../../wr/credit_applications/index.html) |
| `createCreditApplication` | POST `/credit-applications` | credit.apply | Idempotency-Key | M25/M25 | Owner | [Lập phiếu bù trừ](../../wr/credit_applications/editor.html) |
| `getCreditApplication` | GET `/credit-applications/{documentId}` | (credit.apply | debt.read) | — | M25/M25 | Owner | [Chi tiết bù trừ](../../wr/credit_applications/detail.html) |
| `updateCreditApplicationDraft` | PATCH `/credit-applications/{documentId}` | credit.apply | If-Match | M25/M25 | Owner | [Lập phiếu bù trừ](../../wr/credit_applications/editor.html) |
| `postCreditApplication` | POST `/credit-applications/{documentId}/post` | credit.apply | If-Match, Idempotency-Key | M25/M25 | Owner | [Xác nhận bù trừ](../../wr/credit_applications/review.html) |
| `correctCreditApplication` | POST `/credit-applications/{documentId}/corrections` | documents.correct & credit.apply | If-Match, Idempotency-Key | M29/M29 | Owner | [Chi tiết bù trừ](../../wr/credit_applications/detail.html) |
| `cancelCreditApplication` | POST `/credit-applications/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M25/M29 | Owner | [Chi tiết bù trừ](../../wr/credit_applications/detail.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Credit application is not new cash; posted correction/cancel full-gated at M29. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
