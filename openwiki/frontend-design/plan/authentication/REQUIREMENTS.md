# F02 — authentication: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Implement all seven real authentication actions with tab-scoped refresh, permission reload and safe reset links.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F02-SCR01 | Enter email and untouched password; load current grants after login. | Email|Mật khẩu | Incorrect password|Locked account|Rate limited |
| F02-SCR02 | Offer the same accepted response for every valid email. | Email|Gửi yêu cầu | Accepted|Delivery unavailable|429 |
| F02-SCR03 | Consume a one-time fragment and return to sign-in. | Mật khẩu mới|Xác nhận mật khẩu | Expired link|Used link|Completed |
| F02-SCR04 | Verify the current password and invalidate sessions on success. | Mật khẩu hiện tại|Mật khẩu mới | Wrong current password|Sign in again|Locked |
| F02-SCR05 | Show session restoration, expiration and deliberate reauthentication. | Phiên hiện tại|Thử đăng nhập lại | Lost refresh reply|Duplicate tab|Session revoked |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `login` | POST `/auth/login` | public / bearer-only (see source security) | — | M01/M01 | Owner | [Đăng nhập](../../wr/authentication/index.html) |
| `refreshTokens` | POST `/auth/refresh` | public / bearer-only (see source security) | — | M01/M01 | Owner | [Phiên đăng nhập](../../wr/authentication/session.html) |
| `logout` | POST `/auth/logout` | public / bearer-only (see source security) | — | M01/M01 | Owner | [Phiên đăng nhập](../../wr/authentication/session.html) |
| `getCurrentUser` | GET `/auth/me` | public / bearer-only (see source security) | — | M01/M01 | Owner | [Phiên đăng nhập](../../wr/authentication/session.html) |
| `changePassword` | PUT `/auth/password` | public / bearer-only (see source security) | — | M01/M01 | Owner | [Đổi mật khẩu](../../wr/authentication/change-password.html) |
| `requestPasswordReset` | POST `/auth/password-reset-requests` | public / bearer-only (see source security) | — | M01/M01 | Owner | [Quên mật khẩu](../../wr/authentication/forgot-password.html) |
| `resetPasswordWithToken` | POST `/auth/password-resets` | public / bearer-only (see source security) | — | M01/M01 | Owner | [Đặt lại mật khẩu](../../wr/authentication/reset-password.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Single-use refresh: one winner; wrong-current-password 401 must never trigger a refresh loop.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
