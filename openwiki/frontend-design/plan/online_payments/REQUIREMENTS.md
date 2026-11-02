# F26 — online_payments: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Initiate sandbox collection and reconcile only server-verified payment evidence.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F26-SCR01 | Find pending, success, failed and expired attempts. | Đại lý|Số tiền|Mã giao dịch|Trạng thái | Pending|Failed/expired|Late success |
| F26-SCR02 | Start one bounded intent against current debt and supported sandbox. | Đại lý|Số tiền|Cổng thử nghiệm | Unsupported provider|Amount exceeds debt|Uncertain setup |
| F26-SCR03 | Present checkout only when server supplies a trusted URL. | Số tiền|Địa chỉ thanh toán|Hạn | 202 setup pending|URL unavailable|Return without proof |
| F26-SCR04 | Browser return is not verified money; poll existing payment. | Mã giao dịch|Kiểm tra trạng thái | Still pending|Return failed|Reconcile |
| F26-SCR05 | Show full verified receipt and any excess dealer credit. | Tiền thực nhận|Đã trừ nợ|Dư có tạo|Phiếu thu | Late SUCCESS|Duplicate callback|Failed |
| F26-SCR06 | Read authorized normalized event summaries only. | Thời gian|Nguồn|Trạng thái xác minh | Invalid signature hidden|Repeated event|No events |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listOnlinePayments` | GET `/online-payments` | (payments.online | debt.read) | — | M26/M26 | Owner | [Thanh toán trực tuyến](../../wr/online_payments/index.html) |
| `createOnlinePayment` | POST `/online-payments` | payments.online | Idempotency-Key | M26/M26 | Owner | [Tạo thanh toán](../../wr/online_payments/create.html) |
| `getOnlinePayment` | GET `/online-payments/{paymentId}` | (payments.online | debt.read) | — | M26/M26 | Owner | [Kết quả thanh toán](../../wr/online_payments/detail.html) |
| `listPaymentEvents` | GET `/online-payments/{paymentId}/events` | payments.online | — | M26/M26 | Owner | [Sự kiện thanh toán](../../wr/online_payments/events.html) |
| `reconcileOnlinePayment` | POST `/online-payments/{paymentId}/reconcile` | payments.online | Idempotency-Key | M26/M26 | Owner | [Kết quả thanh toán](../../wr/online_payments/detail.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- The provider webhook is server-to-server, not a frontend action; no return URL proves SUCCESS.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
