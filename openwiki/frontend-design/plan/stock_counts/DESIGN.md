# F22 — stock_counts: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/stock_counts/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F22-SCR01 [Kiểm kê kho](../../wr/stock_counts/index.html):** Find draft and confirmed counts. Visible fields: Mã kiểm kê|Thời điểm đếm|Số mặt hàng|Trạng thái. Model explicitly: No counts|Confirmed immutable|Filtered.
- **F22-SCR02 [Ghi số kiểm kê](../../wr/stock_counts/editor.html):** Enter physical observed quantity beside captured book quantity. Visible fields: Mặt hàng|Sổ kho|Đếm thực tế|Chênh lệch. Model explicitly: Zero difference retained|Stale snapshot|Invalid fraction.
- **F22-SCR03 [Xác nhận kiểm kê](../../wr/stock_counts/review.html):** Require extra adjustment-post grant only when any difference is nonzero. Visible fields: Số dòng|Chênh lệch|Phiếu điều chỉnh. Model explicitly: Missing extra grant|Stale movement|No adjustment for zero.
- **F22-SCR04 [Đếm lại sau biến động](../../wr/stock_counts/recount.html):** New physical observations for every existing product, not silent rebasing. Visible fields: Dòng cũ|Biến động mới|Số đếm mới. Model explicitly: Same final stock yet stale|Incomplete recount|412.
- **F22-SCR05 [Biên bản kiểm kê](../../wr/stock_counts/detail.html):** Show immutable observations and generated adjustment link. Visible fields: Sổ kho đã chụp|Thực đếm|Phiếu điều chỉnh. Model explicitly: Zero-difference|Confirmed|No deletion.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

An intervening movement is stale even if the quantity returns to its original value. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/stock-counts`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
