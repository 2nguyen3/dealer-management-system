# F21 — stock_adjustments: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Post independent signed stock changes with a reason; count-generated adjustments are immutable.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F21-SCR01 | Search independent and count-generated adjustments. | Phiếu|Nguồn|Lý do|Trạng thái | Count generated read-only|No results|Cancelled |
| F21-SCR02 | Enter nonzero signed quantity; no sale or monetary fields. | Ngày nghiệp vụ|Mặt hàng|Chênh lệch +/-|Lý do | Zero delta|Historical negative stock|Unit precision |
| F21-SCR03 | Check affected products and server-authoritative new balance. | Chênh lệch|Tồn dự kiến|Lý do | Permission denied|412|Historical blocker |
| F21-SCR04 | Link to count if generated and show no monetary effects. | Nguồn|Phiên bản|Biến động|Tồn sau | Confirmed count immutable|Corrected independent|Cancelled |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listStockAdjustments` | GET `/stock-adjustments` | (stock.adjustment.prepare | stock.adjustment.post | inventory.read) | — | M21/M21 | Owner | [Điều chỉnh tồn](../../wr/stock_adjustments/index.html) |
| `createStockAdjustment` | POST `/stock-adjustments` | stock.adjustment.prepare | Idempotency-Key | M21/M21 | Owner | [Lập phiếu điều chỉnh](../../wr/stock_adjustments/editor.html) |
| `getStockAdjustment` | GET `/stock-adjustments/{documentId}` | (stock.adjustment.prepare | stock.adjustment.post | inventory.read) | — | M21/M21 | Owner | [Chi tiết điều chỉnh](../../wr/stock_adjustments/detail.html) |
| `updateStockAdjustmentDraft` | PATCH `/stock-adjustments/{documentId}` | stock.adjustment.prepare | If-Match | M21/M21 | Owner | [Lập phiếu điều chỉnh](../../wr/stock_adjustments/editor.html) |
| `postStockAdjustment` | POST `/stock-adjustments/{documentId}/post` | stock.adjustment.post | If-Match, Idempotency-Key | M21/M21 | Owner | [Xác nhận điều chỉnh](../../wr/stock_adjustments/review.html) |
| `correctStockAdjustment` | POST `/stock-adjustments/{documentId}/corrections` | documents.correct & stock.adjustment.post | If-Match, Idempotency-Key | M29/M29 | Owner | [Chi tiết điều chỉnh](../../wr/stock_adjustments/detail.html) |
| `cancelStockAdjustment` | POST `/stock-adjustments/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M21/M29 | Owner | [Chi tiết điều chỉnh](../../wr/stock_adjustments/detail.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Adjustments do not create sales or change purchase-price source.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
