# F16 — stock_receipts: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Prepare and post incoming goods, then integrate full lines and later correction/cancellation.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F16-SCR01 | Find drafts and posted receipts by business date/status. | Mã phiếu|Ngày nghiệp vụ|Trạng thái|Giá trị | No receipts|Canceled|Filtered |
| F16-SCR02 | Enter one product per line, quantity and positive purchase price. | Ngày nghiệp vụ|Mặt hàng|Số lượng|Giá nhập | Duplicate line|Inactive unit|Invalid price |
| F16-SCR03 | Review draft against latest version before authoritative posting. | Dòng hàng|Tổng tiền|Người xác nhận | 412|Historical stock dependency|Unknown result |
| F16-SCR04 | Show committed stock changes and the historical purchase-price source. | Phiên bản|Dòng hàng|Tồn sau ghi sổ|Nguồn giá | Posted immutable|Corrected|Cancel blocked |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listStockReceipts` | GET `/stock-receipts` | (stock.receipt.prepare | stock.receipt.post | inventory.read) | — | M15/M15 | Owner | [Phiếu nhập hàng](../../wr/stock_receipts/index.html) |
| `createStockReceipt` | POST `/stock-receipts` | stock.receipt.prepare | Idempotency-Key | M15/M15 | Owner | [Lập phiếu nhập](../../wr/stock_receipts/editor.html) |
| `getStockReceipt` | GET `/stock-receipts/{documentId}` | (stock.receipt.prepare | stock.receipt.post | inventory.read) | — | M15/M15 | Owner | [Chi tiết phiếu nhập](../../wr/stock_receipts/detail.html) |
| `updateStockReceiptDraft` | PATCH `/stock-receipts/{documentId}` | stock.receipt.prepare | If-Match | M15/M15 | Owner | [Lập phiếu nhập](../../wr/stock_receipts/editor.html) |
| `postStockReceipt` | POST `/stock-receipts/{documentId}/post` | stock.receipt.post | If-Match, Idempotency-Key | M15/M15 | Owner | [Xác nhận nhập kho](../../wr/stock_receipts/review.html) |
| `correctStockReceipt` | POST `/stock-receipts/{documentId}/corrections` | documents.correct & stock.receipt.post | If-Match, Idempotency-Key | M29/M29 | Owner | [Chi tiết phiếu nhập](../../wr/stock_receipts/detail.html) |
| `cancelStockReceipt` | POST `/stock-receipts/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M15/M29 | Owner | [Chi tiết phiếu nhập](../../wr/stock_receipts/detail.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Receipt create-with-lines is distinct from later published shared line editing and full cancellation.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
