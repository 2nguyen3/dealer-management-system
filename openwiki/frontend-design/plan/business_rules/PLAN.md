# F11 — business_rules: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Manage the singleton district capacity and selling-price multiplier without rewriting snapshots. This module owns its feature under `ui/src/features/business_rules/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F08, F09. **Backend gates:** M10. The rendered [module wireframe](../../wr/business_rules/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F11-SCR01 | [Quy định hiện hành](../../wr/business_rules/index.html) | Display global capacity and exact price rate. | Read-only|Unavailable|412 |
| F11-SCR02 | [Sửa quy định](../../wr/business_rules/editor.html) | Review versioned capacity/rate edits. | Invalid decimal|Stale ETag|Derived price decision |
| F11-SCR03 | [Sức chứa không hợp lệ](../../wr/business_rules/capacity-conflict.html) | List districts currently exceeding the proposed capacity. | Multiple blockers|Reload|Retry after change |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `getBusinessRules` | GET `/business-rules` | (rules.manage | agency.manage | stock.issue.prepare | inventory.read) | — | M10/M10 | Owner | [Quy định hiện hành](../../wr/business_rules/index.html) |
| `updateBusinessRules` | PATCH `/business-rules` | rules.manage | If-Match | M10/M10 | Owner | [Sửa quy định](../../wr/business_rules/editor.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

D16 must settle derived quote bounds before rate/price consumers publish. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
