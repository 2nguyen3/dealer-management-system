# F30 — reports: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Build five filterable read products and authorized full-filter XLSX/PDF exports. This module owns its feature under `ui/src/features/reports/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F29. **Backend gates:** M30. The rendered [module wireframe](../../wr/reports/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F30-SCR01 | [Trung tâm báo cáo](../../wr/reports/index.html) | Choose a business-date period and one of five read products. | No permission|Empty period|Unavailable |
| F30-SCR02 | [Báo cáo doanh số đại lý](../../wr/reports/sales.html) | Show gross, return, net and company-gross share by code. | Returns-only negative net|Gross zero|Filtered denominator |
| F30-SCR03 | [Báo cáo công nợ](../../wr/reports/debt.html) | Break out charges and cash/return/credit decreases. | Decrease not cash|Backdated replay|No records |
| F30-SCR04 | [Báo cáo nhập xuất tồn](../../wr/reports/inventory.html) | Keep quantities and units by product, without adding unlike units. | Zero movement|Reversed entry|Mixed units |
| F30-SCR05 | [Báo cáo bán theo mặt hàng](../../wr/reports/product-sales.html) | Compare sold/returned quantities and exact VND values. | Zero-value return line|No sales|Negative net |
| F30-SCR06 | [Báo cáo thu chi và dư có](../../wr/reports/cash-credit.html) | Separate actual cash, refund, verified-unreceipted and period/current credit. | UNKNOWN reserved|Historical vs current|Cash != credit |
| F30-SCR07 | [Xuất báo cáo](../../wr/reports/export.html) | Choose XLSX/PDF for all filtered rows and show authenticated download state. | 406|Download failed|More than current page |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `getSalesReport` | GET `/reports/sales` | reports.read & sales.read | — | M30/M30 | Owner | [Báo cáo doanh số đại lý](../../wr/reports/sales.html) |
| `getDebtReport` | GET `/reports/debt` | reports.read & debt.read | — | M30/M30 | Owner | [Báo cáo công nợ](../../wr/reports/debt.html) |
| `getInventoryReport` | GET `/reports/inventory` | reports.read & inventory.read | — | M30/M30 | Owner | [Báo cáo nhập xuất tồn](../../wr/reports/inventory.html) |
| `getProductSalesReport` | GET `/reports/product-sales` | reports.read & sales.read | — | M30/M30 | Owner | [Báo cáo bán theo mặt hàng](../../wr/reports/product-sales.html) |
| `getCashAndCreditReport` | GET `/reports/cash-and-credit` | reports.read & debt.read | — | M30/M30 | Owner | [Báo cáo thu chi và dư có](../../wr/reports/cash-credit.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

All five report operation IDs negotiate JSON/XLSX/PDF through Accept; export is full-filter, not current-page. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
