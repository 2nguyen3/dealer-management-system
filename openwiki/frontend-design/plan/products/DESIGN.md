# F12 — products: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/products/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F12-SCR01 [Mặt hàng](../../wr/products/index.html):** Find products, current stock, current quote and low-stock flags. Visible fields: Mã hàng|Đơn vị|Tồn hiện tại|Giá hiện tại. Model explicitly: No price source|Low stock|Inactive.
- **F12-SCR02 [Chi tiết mặt hàng](../../wr/products/detail.html):** Show latest business-date purchase source and inventory links. Visible fields: Mã hàng|Nguồn giá|Tồn|Mức cảnh báo. Model explicitly: Derived quote unusable|Source reversed|Read-only.
- **F12-SCR03 [Tạo hoặc sửa mặt hàng](../../wr/products/editor.html):** Edit name, unit and threshold; never let users set stock/price. Visible fields: Tên|Đơn vị|Mức cảnh báo|Trạng thái. Model explicitly: Unit used|Duplicate names|Eligible-delete conflict.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

D02 eligible deletion and D16 derived selling-price response policy must be resolved. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/products`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
