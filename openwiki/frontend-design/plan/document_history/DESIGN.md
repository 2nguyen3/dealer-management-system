# F28 — document_history: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/document_history/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F28-SCR01 [Tra cứu chứng từ](../../wr/document_history/index.html):** Cross-kind search by code/date/status subject to kind permissions. Visible fields: Mã phiếu|Loại|Ngày nghiệp vụ|Trạng thái. Model explicitly: Kind denied|No matches|Historical.
- **F28-SCR02 [Lịch sử phiên bản](../../wr/document_history/revisions.html):** Track DRAFT/READY/POSTED revisions under a stable document number. Visible fields: Số phiên bản|Lý do|Người sửa|Thời gian. Model explicitly: No edit of old revision|Canceled|Corrected.
- **F28-SCR03 [Nội dung phiên bản cũ](../../wr/document_history/revision.html):** Show contact and product snapshots as they were recorded. Visible fields: Liên hệ lúc ghi|Dòng hàng|Tổng tiền. Model explicitly: Master renamed|Financial no lines|Immutable.
- **F28-SCR04 [So sánh hai phiên bản](../../wr/document_history/compare.html):** Display old/new values and effect history without claiming prospective dry run. Visible fields: Trước|Sau|Ngày gốc|Lý do. Model explicitly: Original-period changes|Reversal|Permission denied.
- **F28-SCR05 [Bản in chứng từ](../../wr/document_history/print.html):** Select revision and HTML/PDF, preserving DRAFT/CANCELLED marker. Visible fields: Phiên bản|Định dạng|Dấu trạng thái. Model explicitly: 401/403|PDF unavailable|Historical snapshot.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Bearer-protected print requires fetch/blob or authenticated HTML handling, not a bare hyperlink. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/document-history`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
