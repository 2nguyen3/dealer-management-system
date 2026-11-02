# F05 — users: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Create and manage employee accounts; do not display returned passwords or claim reset unlocks a locked account. This module owns its feature under `ui/src/features/users/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F04. **Backend gates:** M04. The rendered [module wireframe](../../wr/users/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F05-SCR01 | [Tài khoản nhân viên](../../wr/users/index.html) | Find staff by email, group and status. | Duplicate email|Empty|Permission denied |
| F05-SCR02 | [Chi tiết tài khoản](../../wr/users/detail.html) | Show status, group and affected-session warning. | Locked|Changed group|Stale version |
| F05-SCR03 | [Tạo hoặc cập nhật nhân viên](../../wr/users/editor.html) | Preserve password bytes and use group selection only when authorized. | Email conflict|Invalid form|Concurrent change |
| F05-SCR04 | [Đặt lại mật khẩu nhân viên](../../wr/users/password-reset.html) | Admin reset revokes all sessions; locked account stays locked. | Missing permission|412|Session invalidated |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listUsers` | GET `/users` | users.manage | — | M04/M04 | Owner | [Tài khoản nhân viên](../../wr/users/index.html) |
| `createUser` | POST `/users` | users.manage | — | M04/M04 | Owner | [Tạo hoặc cập nhật nhân viên](../../wr/users/editor.html) |
| `getUser` | GET `/users/{userId}` | users.manage | — | M04/M04 | Owner | [Chi tiết tài khoản](../../wr/users/detail.html) |
| `updateUser` | PATCH `/users/{userId}` | users.manage | If-Match | M04/M04 | Owner | [Tạo hoặc cập nhật nhân viên](../../wr/users/editor.html) |
| `resetUserPassword` | POST `/users/{userId}/password-reset` | users.manage | If-Match | M04/M04 | Owner | [Đặt lại mật khẩu nhân viên](../../wr/users/password-reset.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Group/status/admin-password changes invalidate live sessions; email uniqueness is case-insensitive. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
