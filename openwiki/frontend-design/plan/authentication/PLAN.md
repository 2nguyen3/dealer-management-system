# F02 — authentication: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Implement all seven real authentication actions with tab-scoped refresh, permission reload and safe reset links. This module owns its feature under `ui/src/features/authentication/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F01. **Backend gates:** M01. The rendered [module wireframe](../../wr/authentication/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F02-SCR01 | [Đăng nhập](../../wr/authentication/index.html) | Enter email and untouched password; load current grants after login. | Incorrect password|Locked account|Rate limited |
| F02-SCR02 | [Quên mật khẩu](../../wr/authentication/forgot-password.html) | Offer the same accepted response for every valid email. | Accepted|Delivery unavailable|429 |
| F02-SCR03 | [Đặt lại mật khẩu](../../wr/authentication/reset-password.html) | Consume a one-time fragment and return to sign-in. | Expired link|Used link|Completed |
| F02-SCR04 | [Đổi mật khẩu](../../wr/authentication/change-password.html) | Verify the current password and invalidate sessions on success. | Wrong current password|Sign in again|Locked |
| F02-SCR05 | [Phiên đăng nhập](../../wr/authentication/session.html) | Show session restoration, expiration and deliberate reauthentication. | Lost refresh reply|Duplicate tab|Session revoked |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `login` | POST `/auth/login` | public / bearer-only (see source security) | — | M01/M01 | Owner | [Đăng nhập](../../wr/authentication/index.html) |
| `refreshTokens` | POST `/auth/refresh` | public / bearer-only (see source security) | — | M01/M01 | Owner | [Phiên đăng nhập](../../wr/authentication/session.html) |
| `logout` | POST `/auth/logout` | public / bearer-only (see source security) | — | M01/M01 | Owner | [Phiên đăng nhập](../../wr/authentication/session.html) |
| `getCurrentUser` | GET `/auth/me` | public / bearer-only (see source security) | — | M01/M01 | Owner | [Phiên đăng nhập](../../wr/authentication/session.html) |
| `changePassword` | PUT `/auth/password` | public / bearer-only (see source security) | — | M01/M01 | Owner | [Đổi mật khẩu](../../wr/authentication/change-password.html) |
| `requestPasswordReset` | POST `/auth/password-reset-requests` | public / bearer-only (see source security) | — | M01/M01 | Owner | [Quên mật khẩu](../../wr/authentication/forgot-password.html) |
| `resetPasswordWithToken` | POST `/auth/password-resets` | public / bearer-only (see source security) | — | M01/M01 | Owner | [Đặt lại mật khẩu](../../wr/authentication/reset-password.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

Single-use refresh: one winner; wrong-current-password 401 must never trigger a refresh loop. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
