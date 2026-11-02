# F14 — document_workbench: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/document_workbench/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F14-SCR01 [Bàn làm việc chứng từ](../../wr/document_workbench/index.html):** Explain kind-specific actions, drafts and revision states. Visible fields: Loại phiếu|Trạng thái|Phiên bản|Ngày nghiệp vụ. Model explicitly: DRAFT|PENDING/READY|POSTED/CANCELLED.
- **F14-SCR02 [Sửa dòng hàng](../../wr/document_workbench/goods-editor.html):** Goods-kind draft lines use parent ETag; financial documents have none. Visible fields: Mặt hàng|Số lượng|Giá/nguồn|Phiên bản cha. Model explicitly: Duplicate product|Immutable revision|Parent 412.
- **F14-SCR03 [Soạn phiếu tài chính](../../wr/document_workbench/financial-editor.html):** A financial draft uses header fields only; show balance-neutral preview. Visible fields: Đại lý|Ngày nghiệp vụ|Số tiền|Ghi chú. Model explicitly: No goods lines|Missing permission|Invalid amount.
- **F14-SCR04 [Nội dung đã thay đổi](../../wr/document_workbench/conflict.html):** Preserve local edits; compare latest server parent before deliberate retry. Visible fields: Bản bạn nhập|Bản máy chủ|Tải lại. Model explicitly: 412|428|Unknown submit outcome.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Shared line/revision operations are full-gated at M28 even when an earlier kind can create lines. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/document-workbench`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
