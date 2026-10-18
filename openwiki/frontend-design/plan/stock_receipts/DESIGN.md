# F16 — stock_receipts: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/stock_receipts/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F16-SCR01 [Phiếu nhập hàng](../../wr/stock_receipts/index.html):** Find drafts and posted receipts by business date/status. Visible fields: Mã phiếu|Ngày nghiệp vụ|Trạng thái|Giá trị. Model explicitly: No receipts|Canceled|Filtered.
- **F16-SCR02 [Lập phiếu nhập](../../wr/stock_receipts/editor.html):** Enter one product per line, quantity and positive purchase price. Visible fields: Ngày nghiệp vụ|Mặt hàng|Số lượng|Giá nhập. Model explicitly: Duplicate line|Inactive unit|Invalid price.
- **F16-SCR03 [Xác nhận nhập kho](../../wr/stock_receipts/review.html):** Review draft against latest version before authoritative posting. Visible fields: Dòng hàng|Tổng tiền|Người xác nhận. Model explicitly: 412|Historical stock dependency|Unknown result.
- **F16-SCR04 [Chi tiết phiếu nhập](../../wr/stock_receipts/detail.html):** Show committed stock changes and the historical purchase-price source. Visible fields: Phiên bản|Dòng hàng|Tồn sau ghi sổ|Nguồn giá. Model explicitly: Posted immutable|Corrected|Cancel blocked.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Receipt create-with-lines is distinct from later published shared line editing and full cancellation. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/stock-receipts`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
