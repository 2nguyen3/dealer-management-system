# F30 — reports: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Build five filterable read products and authorized full-filter XLSX/PDF exports.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F30-SCR01 | Choose a business-date period and one of five read products. | Từ ngày|Đến ngày (không gồm)|Loại báo cáo | No permission|Empty period|Unavailable |
| F30-SCR02 | Show gross, return, net and company-gross share by code. | Mã đại lý|Doanh số gộp|Trả hàng|Doanh số thuần | Returns-only negative net|Gross zero|Filtered denominator |
| F30-SCR03 | Break out charges and cash/return/credit decreases. | Nợ đầu|Phát sinh|Thu tiền|Trả hàng|Bù trừ|Nợ cuối | Decrease not cash|Backdated replay|No records |
| F30-SCR04 | Keep quantities and units by product, without adding unlike units. | Hàng|Đơn vị|Đầu|Nhập|Xuất|Trả|Cuối | Zero movement|Reversed entry|Mixed units |
| F30-SCR05 | Compare sold/returned quantities and exact VND values. | Mặt hàng|Đã bán|Đã trả|Doanh số thuần | Zero-value return line|No sales|Negative net |
| F30-SCR06 | Separate actual cash, refund, verified-unreceipted and period/current credit. | Tiền thu|Tiền hoàn|Dư có cuối kỳ|Đang dành hiện tại | UNKNOWN reserved|Historical vs current|Cash != credit |
| F30-SCR07 | Choose XLSX/PDF for all filtered rows and show authenticated download state. | Kỳ|Bộ lọc|Định dạng|Tổng số dòng | 406|Download failed|More than current page |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `getSalesReport` | GET `/reports/sales` | reports.read & sales.read | — | M30/M30 | Owner | [Báo cáo doanh số đại lý](../../wr/reports/sales.html) |
| `getDebtReport` | GET `/reports/debt` | reports.read & debt.read | — | M30/M30 | Owner | [Báo cáo công nợ](../../wr/reports/debt.html) |
| `getInventoryReport` | GET `/reports/inventory` | reports.read & inventory.read | — | M30/M30 | Owner | [Báo cáo nhập xuất tồn](../../wr/reports/inventory.html) |
| `getProductSalesReport` | GET `/reports/product-sales` | reports.read & sales.read | — | M30/M30 | Owner | [Báo cáo bán theo mặt hàng](../../wr/reports/product-sales.html) |
| `getCashAndCreditReport` | GET `/reports/cash-and-credit` | reports.read & debt.read | — | M30/M30 | Owner | [Báo cáo thu chi và dư có](../../wr/reports/cash-credit.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- All five report operation IDs negotiate JSON/XLSX/PDF through Accept; export is full-filter, not current-page.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
