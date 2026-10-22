# F21 — stock_adjustments: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/stock_adjustments/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F21-SCR01 [Điều chỉnh tồn](../../wr/stock_adjustments/index.html):** Search independent and count-generated adjustments. Visible fields: Phiếu|Nguồn|Lý do|Trạng thái. Model explicitly: Count generated read-only|No results|Cancelled.
- **F21-SCR02 [Lập phiếu điều chỉnh](../../wr/stock_adjustments/editor.html):** Enter nonzero signed quantity; no sale or monetary fields. Visible fields: Ngày nghiệp vụ|Mặt hàng|Chênh lệch +/-|Lý do. Model explicitly: Zero delta|Historical negative stock|Unit precision.
- **F21-SCR03 [Xác nhận điều chỉnh](../../wr/stock_adjustments/review.html):** Check affected products and server-authoritative new balance. Visible fields: Chênh lệch|Tồn dự kiến|Lý do. Model explicitly: Permission denied|412|Historical blocker.
- **F21-SCR04 [Chi tiết điều chỉnh](../../wr/stock_adjustments/detail.html):** Link to count if generated and show no monetary effects. Visible fields: Nguồn|Phiên bản|Biến động|Tồn sau. Model explicitly: Confirmed count immutable|Corrected independent|Cancelled.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Adjustments do not create sales or change purchase-price source. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/stock-adjustments`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
