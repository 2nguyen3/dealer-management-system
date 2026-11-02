# F19 — upfront_payments: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Verify received upfront cash for the exact READY issue revision; recognize stranded money separately.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F19-SCR01 | Show waiting verification and VERIFIED-but-unreceipted work. | Phiếu xuất|Phiên bản|Số tiền khai báo|Trạng thái | Waiting|Verified unreceipted|Consumed |
| F19-SCR02 | Record evidence, actual receipt instant, method and matching revision. | Phiếu chờ xuất|Số tiền thực nhận|Thời điểm nhận|Phương thức | Wrong revision|No actual money|Permission denied |
| F19-SCR03 | Trace one evidence item to auto receipt or separate receipt. | Phiên bản|Đã nhận|Phiếu thu liên kết|Trạng thái | VERIFIED|CONSUMED|RECEIVED_SEPARATELY |
| F19-SCR04 | Handle verified money when delivery fails; issue remains a separate task. | Tiền đã nhận|Phiếu thu riêng|Công nợ/ dư có | Issue blocked|Already consumed|Uncertain result |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listUpfrontConfirmations` | GET `/upfront-confirmations` | (cash.upfront.verify | cash.receipt.post | stock.issue.post) | — | M19/M19 | Owner | [Khoản trả ngay](../../wr/upfront_payments/index.html) |
| `verifyUpfrontPayment` | POST `/upfront-confirmations` | cash.upfront.verify | Idempotency-Key | M19/M19 | Owner | [Xác nhận tiền trả ngay](../../wr/upfront_payments/verify.html) |
| `getUpfrontConfirmation` | GET `/upfront-confirmations/{confirmationId}` | (cash.upfront.verify | cash.receipt.post | stock.issue.post) | — | M19/M19 | Owner | [Chi tiết xác nhận](../../wr/upfront_payments/detail.html) |
| `receiveUpfrontSeparately` | POST `/upfront-confirmations/{confirmationId}/receive-separately` | cash.receipt.post | If-Match, Idempotency-Key | M19/M19 | Owner | [Ghi nhận tiền riêng](../../wr/upfront_payments/receive-separately.html) |
| `getStockIssue` | GET `/stock-issues/{documentId}` | (stock.issue.prepare | stock.issue.post | debt.read | sales.read) | — | M17/M17 | Consumer | [Chi tiết xác nhận](../../wr/upfront_payments/detail.html) |
| `replacePendingStockIssue` | POST `/stock-issues/{documentId}/revisions` | stock.issue.prepare | If-Match, Idempotency-Key | M17/M19 | Consumer | [Chi tiết xác nhận](../../wr/upfront_payments/detail.html) |
| `postStockIssue` | POST `/stock-issues/{documentId}/post` | stock.issue.post | If-Match, Idempotency-Key | M17/M19 | Consumer | [Chi tiết xác nhận](../../wr/upfront_payments/detail.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- VERIFIED is not a posted receipt; failed shipment must not make cash disappear.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
