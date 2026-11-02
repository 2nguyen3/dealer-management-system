# F31 — dashboard: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Show only sections permitted by live grants; distinguish current balances from selected-period flows.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F31-SCR01 | Summarize authorized business areas and action queues. | Tháng|Đại lý|Doanh số|Hàng chờ | No grants|Section omitted|Partial failure |
| F31-SCR02 | Focus on authorized sales trends and pending issues. | Phiếu chờ|Doanh số|Đại lý | Prepare-only D09 gate|Top 10|Empty month |
| F31-SCR03 | Focus on stock alerts, pending issue and count activity. | Tồn thấp|Phiếu chờ|Kiểm kê | Inventory-only|No disclosure|Unavailable |
| F31-SCR04 | Show receivables and verified money not yet receipted. | Nợ hiện tại|Thu trong kỳ|Tiền đã nhận chờ ghi | Receipt-post-only D09 gate|No double count|Permission lost |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `getDashboard` | GET `/dashboard` | (agency.read | inventory.read | sales.read | debt.read | stock.issue.post | cash.upfront.verify) | — | M31/M31 | Owner | [Tổng quan](../../wr/dashboard/index.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- D09 admission/section-permission mismatch requires a source decision before final integration.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
