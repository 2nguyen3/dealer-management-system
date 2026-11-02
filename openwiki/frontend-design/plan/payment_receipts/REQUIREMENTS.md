# F18 — payment_receipts: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Post manual debt collections with server FIFO; generated and online receipts stay read-only here.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F18-SCR01 | Find manual, automatic and online sources with method/status filters. | Đại lý|Loại thu|Phương thức|Số tiền | Generated read-only|Empty|Canceled |
| F18-SCR02 | Choose same dealer, positive amount, method and business date. | Đại lý|Ngày nghiệp vụ|Tiền thu|Phương thức | Future invoice|Overcollection|Validation |
| F18-SCR03 | Review real cash evidence; allocation is automatic FIFO. | Số tiền|Dư nợ đủ điều kiện|Người xác nhận | Insufficient eligible debt|412|Unknown result |
| F18-SCR04 | Show posted money and read-only allocations to issues. | Phiếu thu|Tiền thực nhận|Phân bổ FIFO|Dư nợ sau | Auto receipt immutable|Correction|Cancel blocked |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listPaymentReceipts` | GET `/payment-receipts` | (cash.receipt.prepare | cash.receipt.post | debt.read) | — | M18/M18 | Owner | [Phiếu thu](../../wr/payment_receipts/index.html) |
| `createPaymentReceipt` | POST `/payment-receipts` | cash.receipt.prepare | Idempotency-Key | M18/M18 | Owner | [Lập phiếu thu công nợ](../../wr/payment_receipts/editor.html) |
| `getPaymentReceipt` | GET `/payment-receipts/{documentId}` | (cash.receipt.prepare | cash.receipt.post | debt.read) | — | M18/M18 | Owner | [Chi tiết phiếu thu](../../wr/payment_receipts/detail.html) |
| `updatePaymentReceiptDraft` | PATCH `/payment-receipts/{documentId}` | cash.receipt.prepare | If-Match | M18/M18 | Owner | [Lập phiếu thu công nợ](../../wr/payment_receipts/editor.html) |
| `postPaymentReceipt` | POST `/payment-receipts/{documentId}/post` | cash.receipt.post | If-Match, Idempotency-Key | M18/M18 | Owner | [Xác nhận tiền đã thu](../../wr/payment_receipts/review.html) |
| `correctPaymentReceipt` | POST `/payment-receipts/{documentId}/corrections` | documents.correct & cash.receipt.post | If-Match, Idempotency-Key | M29/M29 | Owner | [Chi tiết phiếu thu](../../wr/payment_receipts/detail.html) |
| `cancelPaymentReceipt` | POST `/payment-receipts/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M18/M29 | Owner | [Chi tiết phiếu thu](../../wr/payment_receipts/detail.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Never offer manual selection or mutation of invoice allocations.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
