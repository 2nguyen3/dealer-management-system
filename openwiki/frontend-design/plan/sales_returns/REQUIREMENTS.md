# F23 — sales_returns: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Receive actual goods against a posted sale at original price, reducing debt and/or creating credit.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F23-SCR01 | Search posted return events and their originating sale. | Phiếu trả|Phiếu xuất gốc|Ngày nhận thực tế | No returns|Partial|Corrected |
| F23-SCR02 | Inspect originally sold and already returned quantities by line. | Mã phiếu xuất|Mặt hàng|Còn có thể trả | Origin not POSTED|Fully returned|No access |
| F23-SCR03 | Enter actual received quantities with preserved original price. | Ngày nhận hàng|Dòng gốc|Số lượng trả|Lý do | Over-return|Zero monetary rounded line|Invalid fraction |
| F23-SCR04 | Explain stock increase, debt reduction and separate new credit. | Kho tăng|Nợ giảm|Dư có tạo | No automatic refund|Dependent blocker|412 |
| F23-SCR05 | Show real return date, origin and linked financial effects. | Nguồn bán|Giá gốc|Nợ trừ|Dư có phát sinh | Partial history|Correction|Zero-value line |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listSalesReturns` | GET `/sales-returns` | (returns.prepare | returns.post | debt.read | sales.read) | — | M23/M23 | Owner | [Hàng trả lại](../../wr/sales_returns/index.html) |
| `createSalesReturn` | POST `/sales-returns` | returns.prepare | Idempotency-Key | M23/M23 | Owner | [Ghi nhận hàng trả](../../wr/sales_returns/editor.html) |
| `getSalesReturn` | GET `/sales-returns/{documentId}` | (returns.prepare | returns.post | debt.read | sales.read) | — | M23/M23 | Owner | [Chi tiết phiếu trả](../../wr/sales_returns/detail.html) |
| `updateSalesReturnDraft` | PATCH `/sales-returns/{documentId}` | returns.prepare | If-Match | M23/M23 | Owner | [Ghi nhận hàng trả](../../wr/sales_returns/editor.html) |
| `postSalesReturn` | POST `/sales-returns/{documentId}/post` | returns.post | If-Match, Idempotency-Key | M23/M23 | Owner | [Xác nhận nhận hàng](../../wr/sales_returns/review.html) |
| `correctSalesReturn` | POST `/sales-returns/{documentId}/corrections` | documents.correct & returns.post | If-Match, Idempotency-Key | M29/M29 | Owner | [Chi tiết phiếu trả](../../wr/sales_returns/detail.html) |
| `cancelSalesReturn` | POST `/sales-returns/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M23/M29 | Owner | [Chi tiết phiếu trả](../../wr/sales_returns/detail.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- A valid zero-VND line still changes returned quantity and inventory.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
