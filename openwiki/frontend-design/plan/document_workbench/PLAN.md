# F14 — document_workbench: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Own common document editor/line/parent-version patterns without inventing a generic posting endpoint. This module owns its feature under `ui/src/features/document_workbench/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F12, F13. **Backend gates:** M13/M28. The rendered [module wireframe](../../wr/document_workbench/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F14-SCR01 | [Bàn làm việc chứng từ](../../wr/document_workbench/index.html) | Explain kind-specific actions, drafts and revision states. | DRAFT|PENDING/READY|POSTED/CANCELLED |
| F14-SCR02 | [Sửa dòng hàng](../../wr/document_workbench/goods-editor.html) | Goods-kind draft lines use parent ETag; financial documents have none. | Duplicate product|Immutable revision|Parent 412 |
| F14-SCR03 | [Soạn phiếu tài chính](../../wr/document_workbench/financial-editor.html) | A financial draft uses header fields only; show balance-neutral preview. | No goods lines|Missing permission|Invalid amount |
| F14-SCR04 | [Nội dung đã thay đổi](../../wr/document_workbench/conflict.html) | Preserve local edits; compare latest server parent before deliberate retry. | 412|428|Unknown submit outcome |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listDocumentRevisions` | GET `/documents/{documentId}/revisions` | public / bearer-only (see source security) | — | M13/M28 | Consumer | [Bàn làm việc chứng từ](../../wr/document_workbench/index.html) |
| `getDocumentRevision` | GET `/documents/{documentId}/revisions/{revisionNo}` | public / bearer-only (see source security) | — | M13/M28 | Consumer | [Bàn làm việc chứng từ](../../wr/document_workbench/index.html) |
| `listDocumentLines` | GET `/documents/{documentId}/revisions/{revisionNo}/lines` | public / bearer-only (see source security) | — | M13/M28 | Consumer | [Bàn làm việc chứng từ](../../wr/document_workbench/index.html) |
| `createDocumentLine` | POST `/documents/{documentId}/revisions/{revisionNo}/lines` | public / bearer-only (see source security) | If-Match, Idempotency-Key | M13/M28 | Consumer | [Sửa dòng hàng](../../wr/document_workbench/goods-editor.html) |
| `getDocumentLine` | GET `/documents/{documentId}/revisions/{revisionNo}/lines/{lineId}` | public / bearer-only (see source security) | — | M13/M28 | Consumer | [Bàn làm việc chứng từ](../../wr/document_workbench/index.html) |
| `replaceDocumentLine` | PUT `/documents/{documentId}/revisions/{revisionNo}/lines/{lineId}` | public / bearer-only (see source security) | If-Match | M13/M28 | Consumer | [Sửa dòng hàng](../../wr/document_workbench/goods-editor.html) |
| `deleteDocumentLine` | DELETE `/documents/{documentId}/revisions/{revisionNo}/lines/{lineId}` | public / bearer-only (see source security) | If-Match | M13/M28 | Consumer | [Bàn làm việc chứng từ](../../wr/document_workbench/index.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Shared line/revision operations are full-gated at M28 even when an earlier kind can create lines. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
