# F06 — permissions: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Expose the read-only function registry and create/update/revoke group grants with the correct preconditions. This module owns its feature under `ui/src/features/permissions/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F05. **Backend gates:** M05. The rendered [module wireframe](../../wr/permissions/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F06-SCR01 | [Ma trận phân quyền](../../wr/permissions/index.html) | View effective grants by group and function. | No grants|Grant changed elsewhere|Forbidden |
| F06-SCR02 | [Danh mục chức năng](../../wr/permissions/registry.html) | Inspect fixed system functions without user-created entries. | Read-only|No results|Denied |
| F06-SCR03 | [Chi tiết chức năng](../../wr/permissions/function.html) | Explain scope and linked group grants. | Not found|Read-only|Permission lost |
| F06-SCR04 | [Cập nhật quyền](../../wr/permissions/grant.html) | New grant uses If-None-Match: *; existing grant uses If-Match. | Create conflict|412|Revoked on next request |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listFunctions` | GET `/functions` | permissions.manage | — | M05/M05 | Owner | [Ma trận phân quyền](../../wr/permissions/index.html) |
| `getFunction` | GET `/functions/{functionId}` | permissions.manage | — | M05/M05 | Owner | [Ma trận phân quyền](../../wr/permissions/index.html) |
| `listGroupPermissions` | GET `/user-groups/{groupId}/permissions` | permissions.manage | — | M05/M05 | Owner | [Ma trận phân quyền](../../wr/permissions/index.html) |
| `getGroupPermission` | GET `/user-groups/{groupId}/permissions/{functionId}` | permissions.manage | — | M05/M05 | Owner | [Ma trận phân quyền](../../wr/permissions/index.html) |
| `setGroupPermission` | PUT `/user-groups/{groupId}/permissions/{functionId}` | permissions.manage | If-Match, If-None-Match | M05/M05 | Owner | [Cập nhật quyền](../../wr/permissions/grant.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Never send both If-Match and If-None-Match; isAllowed=false revokes without deleting the record. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
