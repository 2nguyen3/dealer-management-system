# F32 — chatbot: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Offer three whitelisted read-only query types with permission-safe disambiguation. This module owns its feature under `ui/src/features/chatbot/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F31. **Backend gates:** M32/D10. The rendered [module wireframe](../../wr/chatbot/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F32-SCR01 | [Trợ lý tra cứu](../../wr/chatbot/index.html) | Ask about dealer debt, inventory or sales without arbitrary SQL. | Unsupported query|403|No history requirement |
| F32-SCR02 | [Kết quả tra cứu](../../wr/chatbot/answer.html) | Explain authorized answer and link to source read product. | No inferred owner|Current asOf|No mutation |
| F32-SCR03 | [Chọn đúng đại lý](../../wr/chatbot/agency-selection.html) | Present code/name/district without revealing candidate balances. | Duplicate names|26+ D10 gate|No broadened grant |
| F32-SCR04 | [Bổ sung thông tin](../../wr/chatbot/clarification.html) | Ask only for missing agency/product/period fields. | Missing context|Unsupported|Read denied |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `queryChatbot` | POST `/chatbot/queries` | public / bearer-only (see source security) | — | M32/M32 | Owner | [Trợ lý tra cứu](../../wr/chatbot/index.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

D10 candidate paging is not yet safe for chatbot-only grants; no invented cursor in the current contract. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
