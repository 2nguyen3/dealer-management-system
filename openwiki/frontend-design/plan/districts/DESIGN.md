# F08 — districts: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/districts/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F08-SCR01 [Quận](../../wr/districts/index.html):** Show active agency count and capacity per district. Visible fields: Mã quận|Tên quận|Đại lý đang hoạt động. Model explicitly: Full district|Inactive|Empty.
- **F08-SCR02 [Chi tiết quận](../../wr/districts/detail.html):** Inspect referencing agencies and eligibility for deletion. Visible fields: Quận|Số đại lý|Trạng thái. Model explicitly: Referenced|No capacity|Read-only.
- **F08-SCR03 [Tạo hoặc cập nhật quận](../../wr/districts/editor.html):** Edit district metadata, not a district-specific capacity. Visible fields: Mã|Tên|Trạng thái. Model explicitly: Duplicate|Referenced delete|412.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Capacity is global and server-enforced under concurrent dealer admissions. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/districts`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
