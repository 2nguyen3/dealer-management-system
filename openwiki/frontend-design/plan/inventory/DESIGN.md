# F15 — inventory: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/inventory/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F15-SCR01 [Tồn kho](../../wr/inventory/index.html):** Open a product stock statement from products. Visible fields: Mặt hàng|Tồn hiện tại|Mức cảnh báo. Model explicitly: Low stock|Zero stock|Denied.
- **F15-SCR02 [Thẻ kho](../../wr/inventory/stock-card.html):** Show signed movements in business-date and stable business order. Visible fields: Từ ngày|Đến ngày (không gồm)|Đầu kỳ|Cuối kỳ. Model explicitly: No movements|Reversed entry|Opening balance.
- **F15-SCR03 [Dòng biến động kho](../../wr/inventory/movement.html):** Link a movement to its source document and historical revision. Visible fields: Ngày nghiệp vụ|Phiếu nguồn|Số lượng|Hiệu lực. Model explicitly: Historical revision|Correction|Missing permission.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Never aggregate unlike product units into a single quantity. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/inventory`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
