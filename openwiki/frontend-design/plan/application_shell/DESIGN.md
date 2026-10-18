# F03 — application_shell: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/application_shell/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F03-SCR01 [Khung ứng dụng](../../wr/application_shell/index.html):** Signed-in shell, account menu and available work areas. Visible fields: Thanh điều hướng|Tài khoản|Nội dung. Model explicitly: No grants|Backend unavailable|Identity switched.
- **F03-SCR02 [Điều hướng theo quyền](../../wr/application_shell/navigation.html):** Demonstrate sales, warehouse, accounting and custom-grant menus. Visible fields: Nhóm mục|Quyền hiện tại|Tác vụ. Model explicitly: Read-only|Changed grant|Mobile navigation.
- **F03-SCR03 [Không có quyền truy cập](../../wr/application_shell/access-denied.html):** Handle a protected deep link after a changed grant. Visible fields: Đường dẫn|Quyền cần thiết. Model explicitly: 403|Locked account|Lost session.
- **F03-SCR04 [Không tìm thấy](../../wr/application_shell/not-found.html):** Differentiate missing routes and records from denied reads. Visible fields: Đường dẫn|Quay lại. Model explicitly: Unknown route|Missing record|Unavailable operation.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Read-only access remains possible without manage grants; no MANAGEMENT bypass. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/application-shell`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
