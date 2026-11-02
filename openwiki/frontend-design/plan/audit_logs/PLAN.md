# F07 — audit_logs: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Browse immutable, redacted USER/SYSTEM audit entries and correlated request IDs. This module owns its feature under `ui/src/features/audit_logs/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F06. **Backend gates:** M06. The rendered [module wireframe](../../wr/audit_logs/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F07-SCR01 | [Nhật ký hệ thống](../../wr/audit_logs/index.html) | Filter audit by actor, function, entity and time. | No records|Denied|Safe redaction |
| F07-SCR02 | [Chi tiết thay đổi](../../wr/audit_logs/detail.html) | Inspect safe before/after snapshots and related entity links. | SYSTEM actor|Missing entity|No sensitive values |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listAuditLogs` | GET `/audit-logs` | audit.read | — | M06/M06 | Owner | [Nhật ký hệ thống](../../wr/audit_logs/index.html) |
| `getAuditLog` | GET `/audit-logs/{auditId}` | audit.read | — | M06/M06 | Owner | [Chi tiết thay đổi](../../wr/audit_logs/detail.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

No edit/delete or raw password, token or provider payload controls. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
