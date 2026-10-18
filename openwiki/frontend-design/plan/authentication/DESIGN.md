# F02 — authentication: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/authentication/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F02-SCR01 [Đăng nhập](../../wr/authentication/index.html):** Enter email and untouched password; load current grants after login. Visible fields: Email|Mật khẩu. Model explicitly: Incorrect password|Locked account|Rate limited.
- **F02-SCR02 [Quên mật khẩu](../../wr/authentication/forgot-password.html):** Offer the same accepted response for every valid email. Visible fields: Email|Gửi yêu cầu. Model explicitly: Accepted|Delivery unavailable|429.
- **F02-SCR03 [Đặt lại mật khẩu](../../wr/authentication/reset-password.html):** Consume a one-time fragment and return to sign-in. Visible fields: Mật khẩu mới|Xác nhận mật khẩu. Model explicitly: Expired link|Used link|Completed.
- **F02-SCR04 [Đổi mật khẩu](../../wr/authentication/change-password.html):** Verify the current password and invalidate sessions on success. Visible fields: Mật khẩu hiện tại|Mật khẩu mới. Model explicitly: Wrong current password|Sign in again|Locked.
- **F02-SCR05 [Phiên đăng nhập](../../wr/authentication/session.html):** Show session restoration, expiration and deliberate reauthentication. Visible fields: Phiên hiện tại|Thử đăng nhập lại. Model explicitly: Lost refresh reply|Duplicate tab|Session revoked.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Single-use refresh: one winner; wrong-current-password 401 must never trigger a refresh loop. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/authentication`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
