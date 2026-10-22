# F17 — stock_issues: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Prepare sale, freeze READY price and post physical issue with correct upfront evidence and current checks.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F17-SCR01 | Queue drafts, waiting issues and posted sales. | Đại lý|Ngày nghiệp vụ|Trạng thái|Trả ngay dự kiến | No permission|Pending|Canceled |
| F17-SCR02 | Select active dealer and products; draft quote remains provisional. | Đại lý|Mặt hàng|Số lượng|Trả ngay dự kiến | No price source|Invalid amount|Dealer terminated |
| F17-SCR03 | Display frozen READY price, verification and stock-not-reserved warning. | Giá đã chốt|Tồn hiện tại|Xác nhận tiền | No verification|Stock consumed|Credit limit |
| F17-SCR04 | Replace pending revision; previous evidence may require separation. | Phiên bản cũ|Dòng mới|Lý do | Verified money blocks replacement|New draft|412 |
| F17-SCR05 | Recheck warehouse stock, dealer and limit; one result with auto receipt. | Tổng phiếu|Trả ngay đã xác nhận|Dư nợ sau | Money retained after failed post|No stock|Uncertain result |
| F17-SCR06 | Separate remaining at issue from current outstanding and linked receipts. | Số phiếu|Trả ngay|Còn nợ lúc xuất|Còn nợ hiện tại | Return linked|Corrected|Paid by credit |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listStockIssues` | GET `/stock-issues` | (stock.issue.prepare | stock.issue.post | debt.read | sales.read) | — | M17/M17 | Owner | [Phiếu xuất hàng](../../wr/stock_issues/index.html) |
| `createStockIssue` | POST `/stock-issues` | stock.issue.prepare | Idempotency-Key | M17/M17 | Owner | [Lập phiếu xuất](../../wr/stock_issues/editor.html) |
| `getStockIssue` | GET `/stock-issues/{documentId}` | (stock.issue.prepare | stock.issue.post | debt.read | sales.read) | — | M17/M17 | Owner | [Chi tiết phiếu xuất](../../wr/stock_issues/detail.html) |
| `updateStockIssueDraft` | PATCH `/stock-issues/{documentId}` | stock.issue.prepare | If-Match | M17/M17 | Owner | [Lập phiếu xuất](../../wr/stock_issues/editor.html) |
| `submitStockIssue` | POST `/stock-issues/{documentId}/submit` | stock.issue.prepare | If-Match, Idempotency-Key | M17/M17 | Owner | [Xác nhận xuất kho](../../wr/stock_issues/review.html) |
| `replacePendingStockIssue` | POST `/stock-issues/{documentId}/revisions` | stock.issue.prepare | If-Match, Idempotency-Key | M17/M19 | Owner | [Lập phiếu xuất](../../wr/stock_issues/editor.html) |
| `postStockIssue` | POST `/stock-issues/{documentId}/post` | stock.issue.post | If-Match, Idempotency-Key | M17/M19 | Owner | [Xác nhận xuất kho](../../wr/stock_issues/review.html) |
| `correctStockIssue` | POST `/stock-issues/{documentId}/corrections` | documents.correct & stock.issue.post | If-Match, Idempotency-Key | M29/M29 | Owner | [Chi tiết phiếu xuất](../../wr/stock_issues/detail.html) |
| `cancelStockIssue` | POST `/stock-issues/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M17/M29 | Owner | [Chi tiết phiếu xuất](../../wr/stock_issues/detail.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Issue post/pending replacement are full-gated at M19; cancel at M29; no READY stock reservation.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
