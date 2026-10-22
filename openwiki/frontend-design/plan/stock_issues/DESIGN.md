# F17 — stock_issues: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/stock_issues/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F17-SCR01 [Phiếu xuất hàng](../../wr/stock_issues/index.html):** Queue drafts, waiting issues and posted sales. Visible fields: Đại lý|Ngày nghiệp vụ|Trạng thái|Trả ngay dự kiến. Model explicitly: No permission|Pending|Canceled.
- **F17-SCR02 [Lập phiếu xuất](../../wr/stock_issues/editor.html):** Select active dealer and products; draft quote remains provisional. Visible fields: Đại lý|Mặt hàng|Số lượng|Trả ngay dự kiến. Model explicitly: No price source|Invalid amount|Dealer terminated.
- **F17-SCR03 [Chờ xuất kho](../../wr/stock_issues/pending.html):** Display frozen READY price, verification and stock-not-reserved warning. Visible fields: Giá đã chốt|Tồn hiện tại|Xác nhận tiền. Model explicitly: No verification|Stock consumed|Credit limit.
- **F17-SCR04 [Thay nội dung chờ xuất](../../wr/stock_issues/replace-pending.html):** Replace pending revision; previous evidence may require separation. Visible fields: Phiên bản cũ|Dòng mới|Lý do. Model explicitly: Verified money blocks replacement|New draft|412.
- **F17-SCR05 [Xác nhận xuất kho](../../wr/stock_issues/review.html):** Recheck warehouse stock, dealer and limit; one result with auto receipt. Visible fields: Tổng phiếu|Trả ngay đã xác nhận|Dư nợ sau. Model explicitly: Money retained after failed post|No stock|Uncertain result.
- **F17-SCR06 [Chi tiết phiếu xuất](../../wr/stock_issues/detail.html):** Separate remaining at issue from current outstanding and linked receipts. Visible fields: Số phiếu|Trả ngay|Còn nợ lúc xuất|Còn nợ hiện tại. Model explicitly: Return linked|Corrected|Paid by credit.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Issue post/pending replacement are full-gated at M19; cancel at M29; no READY stock reservation. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/stock-issues`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
