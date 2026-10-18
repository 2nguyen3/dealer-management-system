# F13 — agencies: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Maintain dealer profiles and irrevocable termination without erasing outstanding obligations. This module owns its feature under `ui/src/features/agencies/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F08, F09, F11. **Backend gates:** M12. The rendered [module wireframe](../../wr/agencies/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F13-SCR01 | [Đại lý](../../wr/agencies/index.html) | Search by immutable dealer code and distinguish duplicate names by district. | Duplicate names|Terminated|No matches |
| F13-SCR02 | [Hồ sơ đại lý](../../wr/agencies/detail.html) | Link issues, receipts, debt and credit without editing balances. | Terminated with debt|Read-only|Missing lookup grant |
| F13-SCR03 | [Tiếp nhận hoặc sửa đại lý](../../wr/agencies/editor.html) | Enter required email and select eligible active type/district. | District full|Limit too low|412 |
| F13-SCR04 | [Ngừng hợp tác](../../wr/agencies/terminate.html) | Require a reason and show continuing collection/return/refund rights. | Already terminated|No reopen|Uncertain intent |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listAgencies` | GET `/agencies` | (agency.read | agency.manage) | — | M12/M12 | Owner | [Đại lý](../../wr/agencies/index.html) |
| `createAgency` | POST `/agencies` | agency.manage | — | M12/M12 | Owner | [Tiếp nhận hoặc sửa đại lý](../../wr/agencies/editor.html) |
| `getAgency` | GET `/agencies/{agencyId}` | (agency.read | agency.manage) | — | M12/M12 | Owner | [Hồ sơ đại lý](../../wr/agencies/detail.html) |
| `updateAgency` | PATCH `/agencies/{agencyId}` | agency.manage | If-Match | M12/M12 | Owner | [Tiếp nhận hoặc sửa đại lý](../../wr/agencies/editor.html) |
| `deleteAgency` | DELETE `/agencies/{agencyId}` | agency.manage | If-Match | M12/M12 | Owner | [Đại lý](../../wr/agencies/index.html) |
| `terminateAgency` | POST `/agencies/{agencyId}/terminate` | agency.manage | If-Match, Idempotency-Key | M12/M12 | Owner | [Ngừng hợp tác](../../wr/agencies/terminate.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

No reactivation endpoint; eligible unused deletion depends on the shared D02 repair. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
