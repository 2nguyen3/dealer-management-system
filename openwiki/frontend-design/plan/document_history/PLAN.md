# F28 — document_history: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Search documents and immutable revisions; print historical snapshots through authenticated requests. This module owns its feature under `ui/src/features/document_history/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F14, F22, F27. **Backend gates:** M28. The rendered [module wireframe](../../wr/document_history/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F28-SCR01 | [Tra cứu chứng từ](../../wr/document_history/index.html) | Cross-kind search by code/date/status subject to kind permissions. | Kind denied|No matches|Historical |
| F28-SCR02 | [Lịch sử phiên bản](../../wr/document_history/revisions.html) | Track DRAFT/READY/POSTED revisions under a stable document number. | No edit of old revision|Canceled|Corrected |
| F28-SCR03 | [Nội dung phiên bản cũ](../../wr/document_history/revision.html) | Show contact and product snapshots as they were recorded. | Master renamed|Financial no lines|Immutable |
| F28-SCR04 | [So sánh hai phiên bản](../../wr/document_history/compare.html) | Display old/new values and effect history without claiming prospective dry run. | Original-period changes|Reversal|Permission denied |
| F28-SCR05 | [Bản in chứng từ](../../wr/document_history/print.html) | Select revision and HTML/PDF, preserving DRAFT/CANCELLED marker. | 401/403|PDF unavailable|Historical snapshot |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `searchDocuments` | GET `/documents` | public / bearer-only (see source security) | — | M28/M28 | Owner | [Tra cứu chứng từ](../../wr/document_history/index.html) |
| `listDocumentRevisions` | GET `/documents/{documentId}/revisions` | public / bearer-only (see source security) | — | M13/M28 | Owner | [Lịch sử phiên bản](../../wr/document_history/revisions.html) |
| `getDocumentRevision` | GET `/documents/{documentId}/revisions/{revisionNo}` | public / bearer-only (see source security) | — | M13/M28 | Owner | [Nội dung phiên bản cũ](../../wr/document_history/revision.html) |
| `listDocumentLines` | GET `/documents/{documentId}/revisions/{revisionNo}/lines` | public / bearer-only (see source security) | — | M13/M28 | Owner | [Nội dung phiên bản cũ](../../wr/document_history/revision.html) |
| `createDocumentLine` | POST `/documents/{documentId}/revisions/{revisionNo}/lines` | public / bearer-only (see source security) | If-Match, Idempotency-Key | M13/M28 | Owner | [Nội dung phiên bản cũ](../../wr/document_history/revision.html) |
| `getDocumentLine` | GET `/documents/{documentId}/revisions/{revisionNo}/lines/{lineId}` | public / bearer-only (see source security) | — | M13/M28 | Owner | [Nội dung phiên bản cũ](../../wr/document_history/revision.html) |
| `replaceDocumentLine` | PUT `/documents/{documentId}/revisions/{revisionNo}/lines/{lineId}` | public / bearer-only (see source security) | If-Match | M13/M28 | Owner | [Nội dung phiên bản cũ](../../wr/document_history/revision.html) |
| `deleteDocumentLine` | DELETE `/documents/{documentId}/revisions/{revisionNo}/lines/{lineId}` | public / bearer-only (see source security) | If-Match | M13/M28 | Owner | [Nội dung phiên bản cũ](../../wr/document_history/revision.html) |
| `printDocument` | GET `/documents/{documentId}/print` | public / bearer-only (see source security) | — | M28/M28 | Owner | [Bản in chứng từ](../../wr/document_history/print.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Bearer-protected print requires fetch/blob or authenticated HTML handling, not a bare hyperlink. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
