# F24 — agency_credit: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Inspect credit origins, lots and reservations separately from receivables. This module owns its feature under `ui/src/features/agency_credit/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F23. **Backend gates:** M24. The rendered [module wireframe](../../wr/agency_credit/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F24-SCR01 | [Dư có đại lý](../../wr/agency_credit/index.html) | Reuse the F20 balance and distinguish total, reserved and available money. | Debt and credit coexist|Unavailable|Denied |
| F24-SCR02 | [Các lô dư có](../../wr/agency_credit/lots.html) | List sourced credit lots, spending and reservations. | No credit|Partially reserved|Expired source |
| F24-SCR03 | [Nguồn một lô dư có](../../wr/agency_credit/lot.html) | Trace return/online excess to original payment receipt. | Original online source|Multi-receipt provenance|Forbidden |
| F24-SCR04 | [Sổ dư có](../../wr/agency_credit/statement.html) | Review dated creation, application and refund effects. | Correction replay|Pending reservation|Historical/current difference |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listAgencyCreditLots` | GET `/agencies/{agencyId}/credit-lots` | (debt.read | credit.apply | cash.refund.post) | — | M24/M24 | Owner | [Các lô dư có](../../wr/agency_credit/lots.html) |
| `getCreditLot` | GET `/credit-lots/{lotId}` | (debt.read | credit.apply | cash.refund.post) | — | M24/M24 | Owner | [Nguồn một lô dư có](../../wr/agency_credit/lot.html) |
| `listAgencyCreditEntries` | GET `/agencies/{agencyId}/credit-entries` | debt.read | — | M24/M24 | Owner | [Sổ dư có](../../wr/agency_credit/statement.html) |
| `getAgencyBalance` | GET `/agencies/{agencyId}/balance` | (debt.read | credit.apply | cash.refund.post) | — | M20/M20 | Consumer | [Dư có đại lý](../../wr/agency_credit/index.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Available credit excludes live reservations; later F27 refund states require regression. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
