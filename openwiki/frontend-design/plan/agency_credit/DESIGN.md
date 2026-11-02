# F24 — agency_credit: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/agency_credit/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F24-SCR01 [Dư có đại lý](../../wr/agency_credit/index.html):** Reuse the F20 balance and distinguish total, reserved and available money. Visible fields: Dư có|Đang dành hoàn|Có thể dùng. Model explicitly: Debt and credit coexist|Unavailable|Denied.
- **F24-SCR02 [Các lô dư có](../../wr/agency_credit/lots.html):** List sourced credit lots, spending and reservations. Visible fields: Nguồn tiền|Phát sinh|Đã dùng|Đang dành. Model explicitly: No credit|Partially reserved|Expired source.
- **F24-SCR03 [Nguồn một lô dư có](../../wr/agency_credit/lot.html):** Trace return/online excess to original payment receipt. Visible fields: Phiếu nguồn|Phiếu gốc|Số còn lại. Model explicitly: Original online source|Multi-receipt provenance|Forbidden.
- **F24-SCR04 [Sổ dư có](../../wr/agency_credit/statement.html):** Review dated creation, application and refund effects. Visible fields: Ngày nghiệp vụ|Loại biến động|Số dư sau. Model explicitly: Correction replay|Pending reservation|Historical/current difference.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Available credit excludes live reservations; later F27 refund states require regression. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/agency-credit`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
