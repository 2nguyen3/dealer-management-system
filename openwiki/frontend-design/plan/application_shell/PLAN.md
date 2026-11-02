# F03 — application_shell: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Compose protected routes and navigation from live allowedFunctions, not role labels. This module owns its feature under `ui/src/features/application_shell/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F02. **Backend gates:** M01/M02. The rendered [module wireframe](../../wr/application_shell/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F03-SCR01 | [Khung ứng dụng](../../wr/application_shell/index.html) | Signed-in shell, account menu and available work areas. | No grants|Backend unavailable|Identity switched |
| F03-SCR02 | [Điều hướng theo quyền](../../wr/application_shell/navigation.html) | Demonstrate sales, warehouse, accounting and custom-grant menus. | Read-only|Changed grant|Mobile navigation |
| F03-SCR03 | [Không có quyền truy cập](../../wr/application_shell/access-denied.html) | Handle a protected deep link after a changed grant. | 403|Locked account|Lost session |
| F03-SCR04 | [Không tìm thấy](../../wr/application_shell/not-found.html) | Differentiate missing routes and records from denied reads. | Unknown route|Missing record|Unavailable operation |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | Shared UI, no owned operation | [Pattern gallery](../../wr/frontend_foundations/index.html) |

This is a shared infrastructure/shell slice; it has no independently owned business operation. Consume only the named health/auth operations and source-backed permissions.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Read-only access remains possible without manage grants; no MANAGEMENT bypass. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
