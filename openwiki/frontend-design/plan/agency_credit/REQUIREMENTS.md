# F24 — agency_credit: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Inspect credit origins, lots and reservations separately from receivables.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F24-SCR01 | Reuse the F20 balance and distinguish total, reserved and available money. | Dư có|Đang dành hoàn|Có thể dùng | Debt and credit coexist|Unavailable|Denied |
| F24-SCR02 | List sourced credit lots, spending and reservations. | Nguồn tiền|Phát sinh|Đã dùng|Đang dành | No credit|Partially reserved|Expired source |
| F24-SCR03 | Trace return/online excess to original payment receipt. | Phiếu nguồn|Phiếu gốc|Số còn lại | Original online source|Multi-receipt provenance|Forbidden |
| F24-SCR04 | Review dated creation, application and refund effects. | Ngày nghiệp vụ|Loại biến động|Số dư sau | Correction replay|Pending reservation|Historical/current difference |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listAgencyCreditLots` | GET `/agencies/{agencyId}/credit-lots` | (debt.read | credit.apply | cash.refund.post) | — | M24/M24 | Owner | [Các lô dư có](../../wr/agency_credit/lots.html) |
| `getCreditLot` | GET `/credit-lots/{lotId}` | (debt.read | credit.apply | cash.refund.post) | — | M24/M24 | Owner | [Nguồn một lô dư có](../../wr/agency_credit/lot.html) |
| `listAgencyCreditEntries` | GET `/agencies/{agencyId}/credit-entries` | debt.read | — | M24/M24 | Owner | [Sổ dư có](../../wr/agency_credit/statement.html) |
| `getAgencyBalance` | GET `/agencies/{agencyId}/balance` | (debt.read | credit.apply | cash.refund.post) | — | M20/M20 | Consumer | [Dư có đại lý](../../wr/agency_credit/index.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Available credit excludes live reservations; later F27 refund states require regression.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
