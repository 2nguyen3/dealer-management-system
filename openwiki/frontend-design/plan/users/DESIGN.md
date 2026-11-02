# F05 — users: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/users/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F05-SCR01 [Tài khoản nhân viên](../../wr/users/index.html):** Find staff by email, group and status. Visible fields: Email|Nhóm|Trạng thái. Model explicitly: Duplicate email|Empty|Permission denied.
- **F05-SCR02 [Chi tiết tài khoản](../../wr/users/detail.html):** Show status, group and affected-session warning. Visible fields: Tên|Email|Nhóm|Tình trạng. Model explicitly: Locked|Changed group|Stale version.
- **F05-SCR03 [Tạo hoặc cập nhật nhân viên](../../wr/users/editor.html):** Preserve password bytes and use group selection only when authorized. Visible fields: Họ tên|Email|Nhóm|Mật khẩu khi tạo. Model explicitly: Email conflict|Invalid form|Concurrent change.
- **F05-SCR04 [Đặt lại mật khẩu nhân viên](../../wr/users/password-reset.html):** Admin reset revokes all sessions; locked account stays locked. Visible fields: Mật khẩu mới|Xác nhận thao tác. Model explicitly: Missing permission|412|Session invalidated.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Group/status/admin-password changes invalidate live sessions; email uniqueness is case-insensitive. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/users`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
