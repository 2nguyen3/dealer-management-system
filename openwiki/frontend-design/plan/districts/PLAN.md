# F08 — districts: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Manage active districts with a capacity derived from global business rules. This module owns its feature under `ui/src/features/districts/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F03. **Backend gates:** M07. The rendered [module wireframe](../../wr/districts/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F08-SCR01 | [Quận](../../wr/districts/index.html) | Show active agency count and capacity per district. | Full district|Inactive|Empty |
| F08-SCR02 | [Chi tiết quận](../../wr/districts/detail.html) | Inspect referencing agencies and eligibility for deletion. | Referenced|No capacity|Read-only |
| F08-SCR03 | [Tạo hoặc cập nhật quận](../../wr/districts/editor.html) | Edit district metadata, not a district-specific capacity. | Duplicate|Referenced delete|412 |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listDistricts` | GET `/districts` | (district.manage | agency.read | agency.manage) | — | M07/M07 | Owner | [Quận](../../wr/districts/index.html) |
| `createDistrict` | POST `/districts` | district.manage | — | M07/M07 | Owner | [Tạo hoặc cập nhật quận](../../wr/districts/editor.html) |
| `getDistrict` | GET `/districts/{districtId}` | (district.manage | agency.read | agency.manage) | — | M07/M07 | Owner | [Chi tiết quận](../../wr/districts/detail.html) |
| `updateDistrict` | PATCH `/districts/{districtId}` | district.manage | If-Match | M07/M07 | Owner | [Tạo hoặc cập nhật quận](../../wr/districts/editor.html) |
| `deleteDistrict` | DELETE `/districts/{districtId}` | district.manage | If-Match | M07/M07 | Owner | [Quận](../../wr/districts/index.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Capacity is global and server-enforced under concurrent dealer admissions. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
