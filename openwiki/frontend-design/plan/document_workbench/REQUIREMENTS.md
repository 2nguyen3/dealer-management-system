# F14 — document_workbench: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Own common document editor/line/parent-version patterns without inventing a generic posting endpoint.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F14-SCR01 | Explain kind-specific actions, drafts and revision states. | Loại phiếu|Trạng thái|Phiên bản|Ngày nghiệp vụ | DRAFT|PENDING/READY|POSTED/CANCELLED |
| F14-SCR02 | Goods-kind draft lines use parent ETag; financial documents have none. | Mặt hàng|Số lượng|Giá/nguồn|Phiên bản cha | Duplicate product|Immutable revision|Parent 412 |
| F14-SCR03 | A financial draft uses header fields only; show balance-neutral preview. | Đại lý|Ngày nghiệp vụ|Số tiền|Ghi chú | No goods lines|Missing permission|Invalid amount |
| F14-SCR04 | Preserve local edits; compare latest server parent before deliberate retry. | Bản bạn nhập|Bản máy chủ|Tải lại | 412|428|Unknown submit outcome |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listDocumentRevisions` | GET `/documents/{documentId}/revisions` | public / bearer-only (see source security) | — | M13/M28 | Consumer | [Bàn làm việc chứng từ](../../wr/document_workbench/index.html) |
| `getDocumentRevision` | GET `/documents/{documentId}/revisions/{revisionNo}` | public / bearer-only (see source security) | — | M13/M28 | Consumer | [Bàn làm việc chứng từ](../../wr/document_workbench/index.html) |
| `listDocumentLines` | GET `/documents/{documentId}/revisions/{revisionNo}/lines` | public / bearer-only (see source security) | — | M13/M28 | Consumer | [Bàn làm việc chứng từ](../../wr/document_workbench/index.html) |
| `createDocumentLine` | POST `/documents/{documentId}/revisions/{revisionNo}/lines` | public / bearer-only (see source security) | If-Match, Idempotency-Key | M13/M28 | Consumer | [Sửa dòng hàng](../../wr/document_workbench/goods-editor.html) |
| `getDocumentLine` | GET `/documents/{documentId}/revisions/{revisionNo}/lines/{lineId}` | public / bearer-only (see source security) | — | M13/M28 | Consumer | [Bàn làm việc chứng từ](../../wr/document_workbench/index.html) |
| `replaceDocumentLine` | PUT `/documents/{documentId}/revisions/{revisionNo}/lines/{lineId}` | public / bearer-only (see source security) | If-Match | M13/M28 | Consumer | [Sửa dòng hàng](../../wr/document_workbench/goods-editor.html) |
| `deleteDocumentLine` | DELETE `/documents/{documentId}/revisions/{revisionNo}/lines/{lineId}` | public / bearer-only (see source security) | If-Match | M13/M28 | Consumer | [Bàn làm việc chứng từ](../../wr/document_workbench/index.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Shared line/revision operations are full-gated at M28 even when an earlier kind can create lines.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
