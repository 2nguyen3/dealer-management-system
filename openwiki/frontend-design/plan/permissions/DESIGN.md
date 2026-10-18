# F06 — permissions: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/permissions/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F06-SCR01 [Ma trận phân quyền](../../wr/permissions/index.html):** View effective grants by group and function. Visible fields: Nhóm|Mã chức năng|Được phép. Model explicitly: No grants|Grant changed elsewhere|Forbidden.
- **F06-SCR02 [Danh mục chức năng](../../wr/permissions/registry.html):** Inspect fixed system functions without user-created entries. Visible fields: Mã chức năng|Tên|Mô tả. Model explicitly: Read-only|No results|Denied.
- **F06-SCR03 [Chi tiết chức năng](../../wr/permissions/function.html):** Explain scope and linked group grants. Visible fields: Mã chức năng|Nhóm được cấp. Model explicitly: Not found|Read-only|Permission lost.
- **F06-SCR04 [Cập nhật quyền](../../wr/permissions/grant.html):** New grant uses If-None-Match: *; existing grant uses If-Match. Visible fields: Nhóm|Chức năng|Cho phép. Model explicitly: Create conflict|412|Revoked on next request.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Never send both If-Match and If-None-Match; isAllowed=false revokes without deleting the record. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/permissions`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
