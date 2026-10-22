# F29 — document_corrections: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/document_corrections/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F29-SCR01 [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html):** Choose a source document and correct-vs-real-event path. Visible fields: Loại phiếu|Số phiếu|Ngày gốc|Lý do. Model explicitly: Not a return|Not a refund|No generic endpoint.
- **F29-SCR02 [Sửa phiếu nhập](../../wr/document_corrections/stock-receipt.html):** Recheck every historical stock checkpoint and price-source dependency. Visible fields: Dòng cũ|Dòng thay thế|Lý do. Model explicitly: Past stock negative|New price source|Cancel blocked.
- **F29-SCR03 [Sửa phiếu xuất](../../wr/document_corrections/stock-issue.html):** Preserve real upfront money, return dependencies and FIFO. Visible fields: Phiên bản cũ|Phiên bản mới|Tiền đã nhận. Model explicitly: Separate received money|Return affected|Debt limit.
- **F29-SCR04 [Sửa phiếu thu](../../wr/document_corrections/payment-receipt.html):** Replay valid allocations without erasing actual cash. Visible fields: Khoản thu gốc|Giá trị đúng|Lý do. Model explicitly: Insufficient future debt|FIFO replay|No fake refund.
- **F29-SCR05 [Sửa điều chỉnh kho](../../wr/document_corrections/stock-adjustment.html):** Correct only independent adjustments, not confirmed-count evidence. Visible fields: Chênh lệch cũ|Chênh lệch đúng|Lý do. Model explicitly: Count-generated immutable|Historical stock|412.
- **F29-SCR06 [Sửa phiếu trả](../../wr/document_corrections/sales-return.html):** Preserve actual return-versus-recording distinction and later credit sources. Visible fields: Hàng gốc|Hàng thực nhận|Giá gốc. Model explicitly: Paid refund source|Over-return|Later rounding.
- **F29-SCR07 [Sửa phiếu bù trừ](../../wr/document_corrections/credit-application.html):** Protect reserved, refunded and reused credit lots. Visible fields: Dư có gốc|Số bù đúng|Lý do. Model explicitly: Reserved credit|Paid refund|FIFO blockers.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Every correction/cancel retains its owning API route and needs documents.correct plus owning post rights where specified. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/document-corrections`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
