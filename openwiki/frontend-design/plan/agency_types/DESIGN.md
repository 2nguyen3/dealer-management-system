# F09 — agency_types: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/agency_types/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F09-SCR01 [Loại đại lý](../../wr/agency_types/index.html):** Search active/inactive types and limit usage. Visible fields: Mã loại|Hạn mức nợ|Số đại lý. Model explicitly: Inactive|Empty|Read-only.
- **F09-SCR02 [Chi tiết loại đại lý](../../wr/agency_types/detail.html):** Inspect current limit, including terminated members. Visible fields: Loại đại lý|Hạn mức|Đại lý tham chiếu. Model explicitly: Used type|Stale balance|Delete blocked.
- **F09-SCR03 [Tạo hoặc sửa loại đại lý](../../wr/agency_types/editor.html):** Edit exact whole-VND maxDebt with optimistic version. Visible fields: Mã|Tên|Hạn mức nợ|Trạng thái. Model explicitly: Invalid VND|Duplicate|412.
- **F09-SCR04 [Không thể hạ hạn mức](../../wr/agency_types/limit-conflict.html):** Show server-listed affected dealers rather than a generic toast. Visible fields: Đại lý|Dư nợ hiện tại|Hạn mức đề xuất. Model explicitly: Active blocker|Terminated blocker|Reload.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Both active and terminated agencies can block lowering the limit. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/agency-types`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
