# F04 — user_groups: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Manage groups without deleting a group still referenced by active or locked staff. This module owns its feature under `ui/src/features/user_groups/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F03. **Backend gates:** M03. The rendered [module wireframe](../../wr/user_groups/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F04-SCR01 | [Nhóm nhân viên](../../wr/user_groups/index.html) | Search groups and current membership counts. | Empty|Filtered|Read-only |
| F04-SCR02 | [Chi tiết nhóm](../../wr/user_groups/detail.html) | Inspect members, grants and safe delete availability. | Referenced by LOCKED user|Delete forbidden|412 |
| F04-SCR03 | [Tạo hoặc sửa nhóm](../../wr/user_groups/editor.html) | Create a distinct code or edit with a strong version. | Duplicate code|Validation|Concurrent edit |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listUserGroups` | GET `/user-groups` | (groups.manage | users.manage | permissions.manage) | — | M03/M03 | Owner | [Nhóm nhân viên](../../wr/user_groups/index.html) |
| `createUserGroup` | POST `/user-groups` | groups.manage | — | M03/M03 | Owner | [Tạo hoặc sửa nhóm](../../wr/user_groups/editor.html) |
| `getUserGroup` | GET `/user-groups/{groupId}` | (groups.manage | users.manage | permissions.manage) | — | M03/M03 | Owner | [Chi tiết nhóm](../../wr/user_groups/detail.html) |
| `updateUserGroup` | PATCH `/user-groups/{groupId}` | groups.manage | If-Match | M03/M03 | Owner | [Tạo hoặc sửa nhóm](../../wr/user_groups/editor.html) |
| `deleteUserGroup` | DELETE `/user-groups/{groupId}` | groups.manage & permissions.manage | If-Match | M03/M03 | Owner | [Nhóm nhân viên](../../wr/user_groups/index.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Delete requires groups.manage AND permissions.manage; grant cleanup is backend-atomic. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
