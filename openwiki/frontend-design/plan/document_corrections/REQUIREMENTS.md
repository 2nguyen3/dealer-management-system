# F29 — document_corrections: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Coordinate full replacement and cancellation within six owning document types, preserving money and history.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F29-SCR01 | Choose a source document and correct-vs-real-event path. | Loại phiếu|Số phiếu|Ngày gốc|Lý do | Not a return|Not a refund|No generic endpoint |
| F29-SCR02 | Recheck every historical stock checkpoint and price-source dependency. | Dòng cũ|Dòng thay thế|Lý do | Past stock negative|New price source|Cancel blocked |
| F29-SCR03 | Preserve real upfront money, return dependencies and FIFO. | Phiên bản cũ|Phiên bản mới|Tiền đã nhận | Separate received money|Return affected|Debt limit |
| F29-SCR04 | Replay valid allocations without erasing actual cash. | Khoản thu gốc|Giá trị đúng|Lý do | Insufficient future debt|FIFO replay|No fake refund |
| F29-SCR05 | Correct only independent adjustments, not confirmed-count evidence. | Chênh lệch cũ|Chênh lệch đúng|Lý do | Count-generated immutable|Historical stock|412 |
| F29-SCR06 | Preserve actual return-versus-recording distinction and later credit sources. | Hàng gốc|Hàng thực nhận|Giá gốc | Paid refund source|Over-return|Later rounding |
| F29-SCR07 | Protect reserved, refunded and reused credit lots. | Dư có gốc|Số bù đúng|Lý do | Reserved credit|Paid refund|FIFO blockers |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `correctStockReceipt` | POST `/stock-receipts/{documentId}/corrections` | documents.correct & stock.receipt.post | If-Match, Idempotency-Key | M29/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `cancelStockReceipt` | POST `/stock-receipts/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M15/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `correctStockIssue` | POST `/stock-issues/{documentId}/corrections` | documents.correct & stock.issue.post | If-Match, Idempotency-Key | M29/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `cancelStockIssue` | POST `/stock-issues/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M17/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `correctPaymentReceipt` | POST `/payment-receipts/{documentId}/corrections` | documents.correct & cash.receipt.post | If-Match, Idempotency-Key | M29/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `cancelPaymentReceipt` | POST `/payment-receipts/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M18/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `correctStockAdjustment` | POST `/stock-adjustments/{documentId}/corrections` | documents.correct & stock.adjustment.post | If-Match, Idempotency-Key | M29/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `cancelStockAdjustment` | POST `/stock-adjustments/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M21/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `correctSalesReturn` | POST `/sales-returns/{documentId}/corrections` | documents.correct & returns.post | If-Match, Idempotency-Key | M29/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `cancelSalesReturn` | POST `/sales-returns/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M23/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `correctCreditApplication` | POST `/credit-applications/{documentId}/corrections` | documents.correct & credit.apply | If-Match, Idempotency-Key | M29/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |
| `cancelCreditApplication` | POST `/credit-applications/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M25/M29 | Consumer | [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Every correction/cancel retains its owning API route and needs documents.correct plus owning post rights where specified.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
