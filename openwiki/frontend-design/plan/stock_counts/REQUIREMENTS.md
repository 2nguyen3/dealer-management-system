# F22 — stock_counts: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Capture book/last-entry snapshot, record physical observations and reconcile stale counts.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F22-SCR01 | Find draft and confirmed counts. | Mã kiểm kê|Thời điểm đếm|Số mặt hàng|Trạng thái | No counts|Confirmed immutable|Filtered |
| F22-SCR02 | Enter physical observed quantity beside captured book quantity. | Mặt hàng|Sổ kho|Đếm thực tế|Chênh lệch | Zero difference retained|Stale snapshot|Invalid fraction |
| F22-SCR03 | Require extra adjustment-post grant only when any difference is nonzero. | Số dòng|Chênh lệch|Phiếu điều chỉnh | Missing extra grant|Stale movement|No adjustment for zero |
| F22-SCR04 | New physical observations for every existing product, not silent rebasing. | Dòng cũ|Biến động mới|Số đếm mới | Same final stock yet stale|Incomplete recount|412 |
| F22-SCR05 | Show immutable observations and generated adjustment link. | Sổ kho đã chụp|Thực đếm|Phiếu điều chỉnh | Zero-difference|Confirmed|No deletion |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listStockCounts` | GET `/stock-counts` | stock.count | — | M22/M22 | Owner | [Kiểm kê kho](../../wr/stock_counts/index.html) |
| `createStockCount` | POST `/stock-counts` | stock.count | Idempotency-Key | M22/M22 | Owner | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `getStockCount` | GET `/stock-counts/{countId}` | stock.count | — | M22/M22 | Owner | [Biên bản kiểm kê](../../wr/stock_counts/detail.html) |
| `updateStockCountDraft` | PATCH `/stock-counts/{countId}` | stock.count | If-Match | M22/M22 | Owner | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `listStockCountLines` | GET `/stock-counts/{countId}/lines` | stock.count | — | M22/M22 | Owner | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `createStockCountLine` | POST `/stock-counts/{countId}/lines` | stock.count | If-Match, Idempotency-Key | M22/M22 | Owner | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `getStockCountLine` | GET `/stock-counts/{countId}/lines/{lineId}` | stock.count | — | M22/M22 | Owner | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `updateStockCountLine` | PATCH `/stock-counts/{countId}/lines/{lineId}` | stock.count | If-Match | M22/M22 | Owner | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `recountStock` | POST `/stock-counts/{countId}/recount` | stock.count | If-Match, Idempotency-Key | M22/M22 | Owner | [Đếm lại sau biến động](../../wr/stock_counts/recount.html) |
| `confirmStockCount` | POST `/stock-counts/{countId}/confirm` | stock.count | If-Match, Idempotency-Key | M22/M22 | Owner | [Xác nhận kiểm kê](../../wr/stock_counts/review.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- An intervening movement is stale even if the quantity returns to its original value.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
