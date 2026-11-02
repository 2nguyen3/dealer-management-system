# F09 — agency_types: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Configure dealer types and debt limits without invalidating existing balances. This module owns its feature under `ui/src/features/agency_types/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F03. **Backend gates:** M08. The rendered [module wireframe](../../wr/agency_types/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F09-SCR01 | [Loại đại lý](../../wr/agency_types/index.html) | Search active/inactive types and limit usage. | Inactive|Empty|Read-only |
| F09-SCR02 | [Chi tiết loại đại lý](../../wr/agency_types/detail.html) | Inspect current limit, including terminated members. | Used type|Stale balance|Delete blocked |
| F09-SCR03 | [Tạo hoặc sửa loại đại lý](../../wr/agency_types/editor.html) | Edit exact whole-VND maxDebt with optimistic version. | Invalid VND|Duplicate|412 |
| F09-SCR04 | [Không thể hạ hạn mức](../../wr/agency_types/limit-conflict.html) | Show server-listed affected dealers rather than a generic toast. | Active blocker|Terminated blocker|Reload |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listAgencyTypes` | GET `/agency-types` | (agency_type.manage | agency.read | agency.manage) | — | M08/M08 | Owner | [Loại đại lý](../../wr/agency_types/index.html) |
| `createAgencyType` | POST `/agency-types` | agency_type.manage | — | M08/M08 | Owner | [Tạo hoặc sửa loại đại lý](../../wr/agency_types/editor.html) |
| `getAgencyType` | GET `/agency-types/{typeId}` | (agency_type.manage | agency.read | agency.manage) | — | M08/M08 | Owner | [Chi tiết loại đại lý](../../wr/agency_types/detail.html) |
| `updateAgencyType` | PATCH `/agency-types/{typeId}` | agency_type.manage | If-Match | M08/M08 | Owner | [Tạo hoặc sửa loại đại lý](../../wr/agency_types/editor.html) |
| `deleteAgencyType` | DELETE `/agency-types/{typeId}` | agency_type.manage | If-Match | M08/M08 | Owner | [Loại đại lý](../../wr/agency_types/index.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Both active and terminated agencies can block lowering the limit. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
