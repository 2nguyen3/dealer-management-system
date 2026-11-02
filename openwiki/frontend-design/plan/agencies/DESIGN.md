# F13 — agencies: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/agencies/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F13-SCR01 [Đại lý](../../wr/agencies/index.html):** Search by immutable dealer code and distinguish duplicate names by district. Visible fields: Mã đại lý|Tên|Quận|Nợ hiện tại. Model explicitly: Duplicate names|Terminated|No matches.
- **F13-SCR02 [Hồ sơ đại lý](../../wr/agencies/detail.html):** Link issues, receipts, debt and credit without editing balances. Visible fields: Mã|Loại|Quận|Hạn mức|Nợ|Dư có. Model explicitly: Terminated with debt|Read-only|Missing lookup grant.
- **F13-SCR03 [Tiếp nhận hoặc sửa đại lý](../../wr/agencies/editor.html):** Enter required email and select eligible active type/district. Visible fields: Tên|Email|Loại|Quận|Ngày tiếp nhận|Điện thoại. Model explicitly: District full|Limit too low|412.
- **F13-SCR04 [Ngừng hợp tác](../../wr/agencies/terminate.html):** Require a reason and show continuing collection/return/refund rights. Visible fields: Lý do ngừng|Dư nợ còn lại|Xác nhận. Model explicitly: Already terminated|No reopen|Uncertain intent.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

No reactivation endpoint; eligible unused deletion depends on the shared D02 repair. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/agencies`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
