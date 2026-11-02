# F01 — frontend_foundations: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Create route, API, exact-value, state, test and accessibility conventions while preserving the health starter. This module owns its feature under `ui/src/features/frontend_foundations/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** Existing UI starter. **Backend gates:** M02 (business transport). The rendered [module wireframe](../../wr/frontend_foundations/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F01-SCR01 | [Mẫu giao diện](../../wr/frontend_foundations/index.html) | Shared operational patterns and system status. | Loading|Empty|Forbidden|Unavailable |
| F01-SCR02 | [Mẫu biểu mẫu](../../wr/frontend_foundations/forms.html) | Reusable labels, validation and version-aware actions. | Invalid field|Stale ETag|Uncertain submit |
| F01-SCR03 | [Mẫu danh sách](../../wr/frontend_foundations/tables.html) | Cursor lists and results filtered without fabricated page counts. | First-use empty|No matches|Stale cursor |
| F01-SCR04 | [Trạng thái hệ thống](../../wr/frontend_foundations/states.html) | Loading, partial reads, request IDs and safe recovery. | 429 retry|503 unavailable|412 review |

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

Source-derived JSON validation and exact amount, ID and business-date representations. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
