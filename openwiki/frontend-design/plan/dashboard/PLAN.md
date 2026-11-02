# F31 — dashboard: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Show only sections permitted by live grants; distinguish current balances from selected-period flows. This module owns its feature under `ui/src/features/dashboard/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F30. **Backend gates:** M31/D09. The rendered [module wireframe](../../wr/dashboard/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F31-SCR01 | [Tổng quan](../../wr/dashboard/index.html) | Summarize authorized business areas and action queues. | No grants|Section omitted|Partial failure |
| F31-SCR02 | [Góc nhìn kinh doanh](../../wr/dashboard/sales.html) | Focus on authorized sales trends and pending issues. | Prepare-only D09 gate|Top 10|Empty month |
| F31-SCR03 | [Góc nhìn kho](../../wr/dashboard/warehouse.html) | Focus on stock alerts, pending issue and count activity. | Inventory-only|No disclosure|Unavailable |
| F31-SCR04 | [Góc nhìn kế toán](../../wr/dashboard/accounting.html) | Show receivables and verified money not yet receipted. | Receipt-post-only D09 gate|No double count|Permission lost |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `getDashboard` | GET `/dashboard` | (agency.read | inventory.read | sales.read | debt.read | stock.issue.post | cash.upfront.verify) | — | M31/M31 | Owner | [Tổng quan](../../wr/dashboard/index.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

D09 admission/section-permission mismatch requires a source decision before final integration. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
