# F25 — credit_applications: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Apply available same-dealer credit to eligible debt with server FIFO and no new cash.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F25-SCR01 | Search application drafts and posted offsets. | Phiếu|Đại lý|Số bù|Trạng thái | No applications|Cancelled|Read-only |
| F25-SCR02 | Choose dealer, date and amount only within unreserved credit/debt. | Đại lý|Ngày nghiệp vụ|Số bù trừ | Reserved funds|Insufficient debt|Validation |
| F25-SCR03 | Review available sources and FIFO result without creating a receipt. | Dư có khả dụng|Nợ đủ điều kiện|Tiền thu mới: 0đ | Credit race|412|No cash |
| F25-SCR04 | Trace consumed lots and settled issues. | Phiếu nguồn|Phiếu nợ|Số bù|Tiền thu | Corrected|Source reserved|Posted immutable |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listCreditApplications` | GET `/credit-applications` | (credit.apply | debt.read) | — | M25/M25 | Owner | [Bù trừ dư có](../../wr/credit_applications/index.html) |
| `createCreditApplication` | POST `/credit-applications` | credit.apply | Idempotency-Key | M25/M25 | Owner | [Lập phiếu bù trừ](../../wr/credit_applications/editor.html) |
| `getCreditApplication` | GET `/credit-applications/{documentId}` | (credit.apply | debt.read) | — | M25/M25 | Owner | [Chi tiết bù trừ](../../wr/credit_applications/detail.html) |
| `updateCreditApplicationDraft` | PATCH `/credit-applications/{documentId}` | credit.apply | If-Match | M25/M25 | Owner | [Lập phiếu bù trừ](../../wr/credit_applications/editor.html) |
| `postCreditApplication` | POST `/credit-applications/{documentId}/post` | credit.apply | If-Match, Idempotency-Key | M25/M25 | Owner | [Xác nhận bù trừ](../../wr/credit_applications/review.html) |
| `correctCreditApplication` | POST `/credit-applications/{documentId}/corrections` | documents.correct & credit.apply | If-Match, Idempotency-Key | M29/M29 | Owner | [Chi tiết bù trừ](../../wr/credit_applications/detail.html) |
| `cancelCreditApplication` | POST `/credit-applications/{documentId}/cancel` | documents.cancel | If-Match, Idempotency-Key | M25/M29 | Owner | [Chi tiết bù trừ](../../wr/credit_applications/detail.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Credit application is not new cash; posted correction/cancel full-gated at M29.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
