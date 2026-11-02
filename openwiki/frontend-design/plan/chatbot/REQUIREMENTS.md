# F32 — chatbot: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Offer three whitelisted read-only query types with permission-safe disambiguation.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F32-SCR01 | Ask about dealer debt, inventory or sales without arbitrary SQL. | Loại câu hỏi|Nội dung|Khoảng ngày | Unsupported query|403|No history requirement |
| F32-SCR02 | Explain authorized answer and link to source read product. | Câu hỏi|Kết quả|Dữ liệu nguồn | No inferred owner|Current asOf|No mutation |
| F32-SCR03 | Present code/name/district without revealing candidate balances. | Mã đại lý|Tên|Quận | Duplicate names|26+ D10 gate|No broadened grant |
| F32-SCR04 | Ask only for missing agency/product/period fields. | Mã đại lý|Mặt hàng|Từ ngày|Đến ngày | Missing context|Unsupported|Read denied |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `queryChatbot` | POST `/chatbot/queries` | public / bearer-only (see source security) | — | M32/M32 | Owner | [Trợ lý tra cứu](../../wr/chatbot/index.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- D10 candidate paging is not yet safe for chatbot-only grants; no invented cursor in the current contract.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
