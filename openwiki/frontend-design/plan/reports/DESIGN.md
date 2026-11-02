# F30 — reports: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/reports/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F30-SCR01 [Trung tâm báo cáo](../../wr/reports/index.html):** Choose a business-date period and one of five read products. Visible fields: Từ ngày|Đến ngày (không gồm)|Loại báo cáo. Model explicitly: No permission|Empty period|Unavailable.
- **F30-SCR02 [Báo cáo doanh số đại lý](../../wr/reports/sales.html):** Show gross, return, net and company-gross share by code. Visible fields: Mã đại lý|Doanh số gộp|Trả hàng|Doanh số thuần. Model explicitly: Returns-only negative net|Gross zero|Filtered denominator.
- **F30-SCR03 [Báo cáo công nợ](../../wr/reports/debt.html):** Break out charges and cash/return/credit decreases. Visible fields: Nợ đầu|Phát sinh|Thu tiền|Trả hàng|Bù trừ|Nợ cuối. Model explicitly: Decrease not cash|Backdated replay|No records.
- **F30-SCR04 [Báo cáo nhập xuất tồn](../../wr/reports/inventory.html):** Keep quantities and units by product, without adding unlike units. Visible fields: Hàng|Đơn vị|Đầu|Nhập|Xuất|Trả|Cuối. Model explicitly: Zero movement|Reversed entry|Mixed units.
- **F30-SCR05 [Báo cáo bán theo mặt hàng](../../wr/reports/product-sales.html):** Compare sold/returned quantities and exact VND values. Visible fields: Mặt hàng|Đã bán|Đã trả|Doanh số thuần. Model explicitly: Zero-value return line|No sales|Negative net.
- **F30-SCR06 [Báo cáo thu chi và dư có](../../wr/reports/cash-credit.html):** Separate actual cash, refund, verified-unreceipted and period/current credit. Visible fields: Tiền thu|Tiền hoàn|Dư có cuối kỳ|Đang dành hiện tại. Model explicitly: UNKNOWN reserved|Historical vs current|Cash != credit.
- **F30-SCR07 [Xuất báo cáo](../../wr/reports/export.html):** Choose XLSX/PDF for all filtered rows and show authenticated download state. Visible fields: Kỳ|Bộ lọc|Định dạng|Tổng số dòng. Model explicitly: 406|Download failed|More than current page.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

All five report operation IDs negotiate JSON/XLSX/PDF through Accept; export is full-filter, not current-page. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/reports`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
