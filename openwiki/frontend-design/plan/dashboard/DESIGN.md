# F31 — dashboard: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/dashboard/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F31-SCR01 [Tổng quan](../../wr/dashboard/index.html):** Summarize authorized business areas and action queues. Visible fields: Tháng|Đại lý|Doanh số|Hàng chờ. Model explicitly: No grants|Section omitted|Partial failure.
- **F31-SCR02 [Góc nhìn kinh doanh](../../wr/dashboard/sales.html):** Focus on authorized sales trends and pending issues. Visible fields: Phiếu chờ|Doanh số|Đại lý. Model explicitly: Prepare-only D09 gate|Top 10|Empty month.
- **F31-SCR03 [Góc nhìn kho](../../wr/dashboard/warehouse.html):** Focus on stock alerts, pending issue and count activity. Visible fields: Tồn thấp|Phiếu chờ|Kiểm kê. Model explicitly: Inventory-only|No disclosure|Unavailable.
- **F31-SCR04 [Góc nhìn kế toán](../../wr/dashboard/accounting.html):** Show receivables and verified money not yet receipted. Visible fields: Nợ hiện tại|Thu trong kỳ|Tiền đã nhận chờ ghi. Model explicitly: Receipt-post-only D09 gate|No double count|Permission lost.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

D09 admission/section-permission mismatch requires a source decision before final integration. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/dashboard`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
