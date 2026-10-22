# F20 — receivables: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Read receivables, invoice balances and allocation provenance without client-side FIFO edits.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F20-SCR01 | Search dealer balances with current asOf time. | Mã đại lý|Nợ hiện tại|Hạn mức|Còn lại | No debt|Terminated dealer|Forbidden |
| F20-SCR02 | Display separate debt, credit, reservation and headroom. | Nợ phải thu|Dư có|Đang dành|Khả dụng | Simultaneous debt and credit|Unavailable|Stale |
| F20-SCR03 | Compare original remainder with current outstanding and settlement sources. | Lúc xuất còn|Đã phân bổ|Còn nợ hiện tại | SETTLED by return|SETTLED by credit|Partial |
| F20-SCR04 | Review opening, dated changes, closing and effective history. | Từ ngày|Đến ngày|Số dư đầu|Biến động | No movements|Backdated replay|Correction |
| F20-SCR05 | Inspect source receipt/credit and target issue with current/reversed legs. | Nguồn tiền|Phiếu được trừ|Ngày nghiệp vụ|Hiệu lực | Reversed|Auto upfront|No edit |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listReceivables` | GET `/receivables` | debt.read | — | M20/M20 | Owner | [Công nợ](../../wr/receivables/index.html) |
| `getAgencyBalance` | GET `/agencies/{agencyId}/balance` | (debt.read | credit.apply | cash.refund.post) | — | M20/M20 | Owner | [Công nợ đại lý](../../wr/receivables/agency.html) |
| `listAgencyInvoiceBalances` | GET `/agencies/{agencyId}/invoice-balances` | debt.read | — | M20/M20 | Owner | [Công nợ phiếu xuất](../../wr/receivables/invoice.html) |
| `getInvoiceBalance` | GET `/stock-issues/{documentId}/balance` | debt.read | — | M20/M20 | Owner | [Công nợ phiếu xuất](../../wr/receivables/invoice.html) |
| `listAgencyReceivableEntries` | GET `/agencies/{agencyId}/receivable-entries` | debt.read | — | M20/M20 | Owner | [Sổ công nợ](../../wr/receivables/statement.html) |
| `listDocumentAllocations` | GET `/documents/{documentId}/allocations` | debt.read | — | M20/M20 | Owner | [Phân bổ thanh toán](../../wr/receivables/allocations.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- The agency balance resource belongs to F20 and is reused—not duplicated—by F24.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
