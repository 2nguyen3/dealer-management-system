# F01 — frontend_foundations: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Create route, API, exact-value, state, test and accessibility conventions while preserving the health starter.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F01-SCR01 | Shared operational patterns and system status. | Trạng thái API|Mã yêu cầu|Chuyển mô-đun | Loading|Empty|Forbidden|Unavailable |
| F01-SCR02 | Reusable labels, validation and version-aware actions. | Nhãn|Giá trị nhập|Lỗi trường|Phiên bản | Invalid field|Stale ETag|Uncertain submit |
| F01-SCR03 | Cursor lists and results filtered without fabricated page counts. | Tìm kiếm|Bộ lọc|Sắp xếp|Trang tiếp | First-use empty|No matches|Stale cursor |
| F01-SCR04 | Loading, partial reads, request IDs and safe recovery. | Mã yêu cầu|Thử lại|Liên hệ hỗ trợ | 429 retry|503 unavailable|412 review |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | Shared UI, no owned operation | [Pattern gallery](../../wr/frontend_foundations/index.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Source-derived JSON validation and exact amount, ID and business-date representations.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
