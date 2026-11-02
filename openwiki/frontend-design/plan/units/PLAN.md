# F10 — units: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Manage units and the integer-versus-three-decimal quantity policy. This module owns its feature under `ui/src/features/units/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F03. **Backend gates:** M09. The rendered [module wireframe](../../wr/units/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F10-SCR01 | [Đơn vị tính](../../wr/units/index.html) | List units and fractional policy. | Inactive|Used|No matches |
| F10-SCR02 | [Chi tiết đơn vị](../../wr/units/detail.html) | Inspect product references and immutable usage constraints. | Recorded use|Delete blocked|Read-only |
| F10-SCR03 | [Tạo hoặc sửa đơn vị](../../wr/units/editor.html) | Select fraction policy; recorded use may prevent changing it. | Invalid fraction|409 used|412 |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listUnits` | GET `/units` | (unit.manage | product.manage | inventory.read) | — | M09/M09 | Owner | [Đơn vị tính](../../wr/units/index.html) |
| `createUnit` | POST `/units` | unit.manage | — | M09/M09 | Owner | [Tạo hoặc sửa đơn vị](../../wr/units/editor.html) |
| `getUnit` | GET `/units/{unitId}` | (unit.manage | product.manage | inventory.read) | — | M09/M09 | Owner | [Chi tiết đơn vị](../../wr/units/detail.html) |
| `updateUnit` | PATCH `/units/{unitId}` | unit.manage | If-Match | M09/M09 | Owner | [Tạo hoặc sửa đơn vị](../../wr/units/editor.html) |
| `deleteUnit` | DELETE `/units/{unitId}` | unit.manage | If-Match | M09/M09 | Owner | [Đơn vị tính](../../wr/units/index.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Fractional policy is not a conversion system and cannot change after recorded use. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
