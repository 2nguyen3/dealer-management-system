# F28 — document_history: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Search documents and immutable revisions; print historical snapshots through authenticated requests.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F28-SCR01 | Cross-kind search by code/date/status subject to kind permissions. | Mã phiếu|Loại|Ngày nghiệp vụ|Trạng thái | Kind denied|No matches|Historical |
| F28-SCR02 | Track DRAFT/READY/POSTED revisions under a stable document number. | Số phiên bản|Lý do|Người sửa|Thời gian | No edit of old revision|Canceled|Corrected |
| F28-SCR03 | Show contact and product snapshots as they were recorded. | Liên hệ lúc ghi|Dòng hàng|Tổng tiền | Master renamed|Financial no lines|Immutable |
| F28-SCR04 | Display old/new values and effect history without claiming prospective dry run. | Trước|Sau|Ngày gốc|Lý do | Original-period changes|Reversal|Permission denied |
| F28-SCR05 | Select revision and HTML/PDF, preserving DRAFT/CANCELLED marker. | Phiên bản|Định dạng|Dấu trạng thái | 401/403|PDF unavailable|Historical snapshot |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
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

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Bearer-protected print requires fetch/blob or authenticated HTML handling, not a bare hyperlink.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
