# F23 — sales_returns: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/sales_returns/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F23-SCR01 [Hàng trả lại](../../wr/sales_returns/index.html):** Search posted return events and their originating sale. Visible fields: Phiếu trả|Phiếu xuất gốc|Ngày nhận thực tế. Model explicitly: No returns|Partial|Corrected.
- **F23-SCR02 [Chọn phiếu xuất gốc](../../wr/sales_returns/source.html):** Inspect originally sold and already returned quantities by line. Visible fields: Mã phiếu xuất|Mặt hàng|Còn có thể trả. Model explicitly: Origin not POSTED|Fully returned|No access.
- **F23-SCR03 [Ghi nhận hàng trả](../../wr/sales_returns/editor.html):** Enter actual received quantities with preserved original price. Visible fields: Ngày nhận hàng|Dòng gốc|Số lượng trả|Lý do. Model explicitly: Over-return|Zero monetary rounded line|Invalid fraction.
- **F23-SCR04 [Xác nhận nhận hàng](../../wr/sales_returns/review.html):** Explain stock increase, debt reduction and separate new credit. Visible fields: Kho tăng|Nợ giảm|Dư có tạo. Model explicitly: No automatic refund|Dependent blocker|412.
- **F23-SCR05 [Chi tiết phiếu trả](../../wr/sales_returns/detail.html):** Show real return date, origin and linked financial effects. Visible fields: Nguồn bán|Giá gốc|Nợ trừ|Dư có phát sinh. Model explicitly: Partial history|Correction|Zero-value line.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

A valid zero-VND line still changes returned quantity and inventory. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/sales-returns`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
