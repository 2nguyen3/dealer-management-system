# F27 — refunds: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Return actual money from a single source receipt while preserving reservation and attempt evidence.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F27-SCR01 | Find document status and independent attempt status. | Phiếu hoàn|Nguồn thu|Đang dành|Kết quả | DRAFT yet reserved|UNKNOWN|Paid |
| F27-SCR02 | Select one eligible original receipt, amount and method. | Phiếu thu nguồn|Ngày dự kiến|Số tiền|Phương thức | Two sources need two refunds|Source exhausted|Insufficient credit |
| F27-SCR03 | Reserve available funds before manual or provider payout. | Dư có hiện tại|Đang dành|Khả dụng sau | Race with offset|Missing permission|412 |
| F27-SCR04 | Show paid, reserved, attempt and document states independently. | Phiếu nguồn|Đã hoàn|Đang dành|Trạng thái xử lý | DRAFT noneditable|Paid immutable|Safe cancel |
| F27-SCR05 | Inspect PENDING, UNKNOWN, FAILED or SUCCESS with reconciliation. | Mã lần thử|Kết quả|Thời điểm đối soát | UNKNOWN retains reservation|Timeout|Verified failure |
| F27-SCR06 | Confirm observed cash/bank payout before committing financial effect. | Bằng chứng thực trả|Số tiền|Ngày trả thực tế | Unpaid|Double confirmation|Wrong source |
| F27-SCR07 | Only after verified failure and released reservation, form a fresh attempt. | Kết quả thất bại|Nguồn|Số tiền | UNKNOWN blocks retry|New revision|No second payout |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listRefunds` | GET `/refunds` | (cash.refund.prepare | cash.refund.post | debt.read) | — | M27/M27 | Owner | [Hoàn tiền](../../wr/refunds/index.html) |
| `createRefund` | POST `/refunds` | cash.refund.prepare | Idempotency-Key | M27/M27 | Owner | [Lập yêu cầu hoàn](../../wr/refunds/editor.html) |
| `getRefund` | GET `/refunds/{documentId}` | (cash.refund.prepare | cash.refund.post | debt.read) | — | M27/M27 | Owner | [Chi tiết phiếu hoàn](../../wr/refunds/detail.html) |
| `updateRefundDraft` | PATCH `/refunds/{documentId}` | cash.refund.prepare | If-Match | M27/M27 | Owner | [Lập yêu cầu hoàn](../../wr/refunds/editor.html) |
| `submitRefund` | POST `/refunds/{documentId}/submit` | cash.refund.post | If-Match, Idempotency-Key | M27/M27 | Owner | [Dành dư có để hoàn](../../wr/refunds/review.html) |
| `confirmManualRefundPaid` | POST `/refunds/{documentId}/confirm-paid` | cash.refund.post | If-Match, Idempotency-Key | M27/M27 | Owner | [Xác nhận đã hoàn tiền](../../wr/refunds/confirm-paid.html) |
| `cancelUnpaidRefund` | POST `/refunds/{documentId}/cancel` | documents.cancel & cash.refund.post | If-Match, Idempotency-Key | M27/M27 | Owner | [Chi tiết phiếu hoàn](../../wr/refunds/detail.html) |
| `listRefundAttempts` | GET `/refunds/{documentId}/attempts` | (cash.refund.post | debt.read) | — | M27/M27 | Owner | [Lần thử hoàn trực tuyến](../../wr/refunds/attempt.html) |
| `requestOnlineRefund` | POST `/refunds/{documentId}/attempts` | cash.refund.post | If-Match, Idempotency-Key | M27/M27 | Owner | [Lần thử hoàn trực tuyến](../../wr/refunds/attempt.html) |
| `getRefundAttempt` | GET `/refund-attempts/{attemptId}` | (cash.refund.post | debt.read) | — | M27/M27 | Owner | [Lần thử hoàn trực tuyến](../../wr/refunds/attempt.html) |
| `reconcileRefundAttempt` | POST `/refund-attempts/{attemptId}/reconcile` | cash.refund.post | Idempotency-Key | M27/M27 | Owner | [Lần thử hoàn trực tuyến](../../wr/refunds/attempt.html) |
| `listRefundReservations` | GET `/refunds/{documentId}/reservations` | (cash.refund.post | debt.read) | — | M27/M27 | Owner | [Chi tiết phiếu hoàn](../../wr/refunds/detail.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- UNKNOWN keeps credit reserved; the source requestOnlineRefund operation has no reason body.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
