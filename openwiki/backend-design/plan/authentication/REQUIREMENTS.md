# Authentication requirements and source traceability

## 1. Source inventory

| ID | Source | Relevant sections / observed behavior |
| --- | --- | --- |
| BA-11 | [BA exploration](../../../BA/DMS_exploration.md) | §2.2.11 / QĐ11 and §4.1.11: unique email login, hash-only passwords, locked accounts cannot log in, preserve account history. |
| BA-12 | Same BA | §2.2.12 / QĐ12: four initial groups; referenced groups cannot be deleted. |
| BA-13 | Same BA | §2.2.13 / QĐ13: function-level access according to the user's group. |
| BA-14 | Same BA | §2.2.14 / QĐ14: important account/group/permission changes audited; audit is read-only. |
| BA-16 | Same BA | §2.2.16 / QĐ16: chatbot reads obey authenticated-user permissions. |
| DB-D | [Database decisions](../../../database-design/business_decision_making.md) | §3: one group per employee, function-level permissions, no inferred dealer ownership. |
| DB-R | [Database README](../../../database-design/README.md) | §4 identity tables; §5.1 transaction-local audit context; §6 password/version/RBAC responsibilities; §9 BA reconciliation. |
| DB-M | [DBML](../../../database-design/DMS.dbml) | `user_group`, `app_function`, `app_user`, `group_permission`, `auth_token`, `audit_log` and their FKs. |
| DB-S | [Versioned DDL](../../../../backend/alembic/sql/0001_initial.sql) | Identity tables at lines 20–73; `audit_change`; `guard_auth_version`; four groups/33 functions and grants; audit trigger registrations. |
| API-A | [Backend API contract](../../API/openapi.json) | Seven `/auth/*` paths; `BearerAuth`; auth request/response schemas and shared responses. |
| API-U | Same API | `/users/{userId}` and admin reset invalidate sessions; permission updates take effect on the next request. |
| RUN | [Backend guide](../../../../backend/AGENTS.md), [README](../../../../backend/README.md) | Current app has health only; synchronous sessions, explicit commits, immutable migrations, Argon2id demo passwords. |
| VERIFY | [Verification workflow](../../../../.agents/workflows/verify.md) | Backend checks; documentation-only checks; live database verification limits. |

The psql [DMS.sql](../../../database-design/DMS.sql) and
[verify.sql](../../../database-design/verify.sql) are entry points, not competing
DDL authorities. The archived legacy schema and older uppercase BA table names
are historical context; implementation maps current `dms` snake_case tables and
quoted camelCase columns.

## 2. Requirement register

| Requirement | Required implementation behavior | Tests |
| --- | --- | --- |
| R01 — Employee identity | Log in with email; compare via PostgreSQL `lower(email)`; no public registration or Supabase Auth integration. Reject whitespace-containing invalid email rather than silently trim. | F02, F10, F21, A01 |
| R02 — Password handling | Argon2id; never return/store plaintext or echo a hash. Password input is any nonempty string, including spaces; do not trim, normalize, truncate, or add composition/minimum-length rules. | F03–F04, F25, F27, A05, S01 |
| R03 — Locking | Wrong credentials 401; authenticated valid credentials/session for LOCKED user 403 where documented. No issuance while locked. Reset does not unlock. | F21–F27, A01–A07, C03 |
| R04 — Tokens | Access JWT in Authorization only; refresh/reset opaque random tokens stored as 32-byte SHA-256 digests; purpose/expiry/revocation checked. | F05–F08, F12–F17, A02, A07 |
| R05 — Rotation/logout | Old refresh revoked on rotation; one successful concurrent refresh; logout idempotent, session-local, revokes access as well as refresh. | F22–F23, A02–A03, C01–C02 |
| R06 — Credential/version invalidation | Password/group/status change invalidates old access and refresh; `authVersion` trigger owns increments; stale tokens cannot mint fresh sessions. | F18, F20, F25, F27, D03, C03–C05 |
| R07 — Current account and permissions | `/auth/me` returns documented user and unique allowed function codes from current DB group; false/missing grants denied. | F11, F19, F24, F29–F30, A04, P01–P03 |
| R08 — Reset-email privacy | Valid request email always gets identical 202 for present/missing/locked accounts; no reset token in HTTP response. Operational outage 503 only through account-independent availability decision. | F26, F32–F34, A06, S02 |
| R09 — Reset single use | Invalid/expired/revoked/wrong-purpose reset token 401; success 204; consume once, update hash, revoke sessions and outstanding reset tokens. | F27, A07, C04–C05 |
| R10 — Audit | Account changes audited atomically with correct actor/request; no user-side audit mutation; token storage itself has no audit trigger in current DDL. | F20, F31, D04, S01 |
| R11 — HTTP contract | CamelCase JSON, decimal-string bigint IDs, required headers/status/error body, strict request fields. | F01–F02, F09, F28, A01–A08 |
| R12 — Throttling | All seven operations can return 429 with Retry-After; limiter applies before expensive work and is deterministic in tests. | F35–F36, A08 |
| R13 — Atomicity | Services explicitly commit; no success before commit; persistence errors roll back issuance, rotation, password changes and audit together. | F21–F27, D05, C01–C05 |

Function/case IDs are defined in [TESTS.md](TESTS.md).

## 3. Endpoint contract

Base URL: `/api/v1`. `security: []` means no access bearer required; possession
of a refresh/reset token is still validated by the service.

| Operation ID | Method/path | Access bearer | Body | Success | Domain errors |
| --- | --- | --- | --- | --- | --- |
| `login` | POST `/auth/login` | No | `email`, `password` | 200 `TokenResponse` | 401 `INVALID_CREDENTIALS`; 403 `ACCOUNT_LOCKED` |
| `refreshTokens` | POST `/auth/refresh` | No | `refreshToken` | 200 `TokenResponse` | 401 `INVALID_OR_EXPIRED_TOKEN`; 403 `ACCOUNT_LOCKED` |
| `logout` | POST `/auth/logout` | No | `refreshToken` | 204 empty | Unknown/revoked token is success, not 401 |
| `getCurrentUser` | GET `/auth/me` | Yes | None | 200 `CurrentUser` | 401 invalid session; 403 locked account |
| `changePassword` | PUT `/auth/password` | Yes | `currentPassword`, `newPassword` | 204 empty | 401 invalid session/current password; 403 locked account |
| `requestPasswordReset` | POST `/auth/password-reset-requests` | No | `email` | 202 `AcceptedMessage` | 503 account-independent delivery unavailability |
| `resetPasswordWithToken` | POST `/auth/password-resets` | No | `token`, `newPassword` | 204 empty | 401 invalid reset token; no 403 locked response |

All operations declare 429 and 500. The six body operations also declare 400,
415, and 422. `/auth/me` does not declare body-validation/media errors.
Do not add 409, 413, 503, or other statuses to these operations without explicitly
updating/reviewing the source contract. Generic database failures are sanitized
500 for auth operations; existing readiness stays 503 with its current payload.

### Schemas and headers

- Requests: strict strings, `extra='forbid'`, required fields, nonempty passwords
  and opaque tokens. `Email` is `format: email` plus `^\S+@\S+$`; use email
  validation without DNS/deliverability checks and preserve PostgreSQL login semantics.
- `TokenResponse`: exactly `accessToken`, `tokenType` = `Bearer`, `expiresAt`,
  `refreshToken`, `refreshExpiresAt`, `user`. No `expiresIn` or permissions added.
- `User`: `id` is a positive decimal **string**; `groupId` an integer;
  `fullName`, `email`, `groupCode`, `groupName`, `status`, `createdAt`, `updatedAt`.
  No `passwordHash`, `authVersion`, `tokenDigest`, or internal session identifier.
- `CurrentUser`: `user` and unique `allowedFunctions`. Return sorted function
  codes for deterministic output; the contract does not require a particular order.
- `AcceptedMessage`: `message`, `requestId`; same safe text for all account states.
- Error object: `code`, `message`, `requestId`, optional safe `fieldErrors`/`details`;
  no FastAPI default `detail` payload for auth failures.
- Token responses require `Cache-Control: no-store` and `X-Request-Id`.
  Apply no-store to other auth responses too as an implementation decision.
- All 401s include `WWW-Authenticate: Bearer`. All auth responses carry a generated
  `X-Request-Id`; errors use the same ID in their body. 429 and reset-service 503
  carry positive integer `Retry-After` seconds.
- 204 responses have zero body bytes, including no `null` or `{}`.
- Bearer auth is documented in runtime OpenAPI. Public auth routes explicitly
  disable it; health routes remain public.

## 4. Gaps and resolutions

| Gap / apparent conflict | Resolution for this plan |
| --- | --- |
| BA describes login but not token format/rotation/reset routes. | API-A defines the HTTP extension; DB-S defines persistence. |
| Current token row has no issuance version or stable session lineage. | Add version/session metadata in a new migration; see DESIGN §2. Checking only the user's current version during refresh is insufficient. |
| Bearer scheme says revoked sessions reject access, while logout names only refresh-session revocation. | Validate a stable live session for every access token. Rotating refresh does not invalidate the session; logging it out does. |
| `guard_auth_version` increments on password hash changes, including Argon2 parameter rehash. | Do not silently rehash at login in this module. Future rehash work must explicitly handle version invalidation. |
| Locked errors and stale versions may both apply. | First validate token cryptography/purpose and known session; then locked state 403 where allowed, then version/expiry/revocation 401. Unknown/wrong credentials never reveal lock state. |
| Reset after the account becomes locked. | A previously issued, otherwise valid reset token may reset a LOCKED account if its issuance version is still current; status remains LOCKED. A status-change version bump usually makes earlier tokens stale. |
| No auth-specific function codes in the 33-function registry. | Password self-change/token reset use existing `users.manage` as audit classification, not a permission requirement; USER actor for self-change, SYSTEM for token reset. Do not introduce unregistered `auth.*` codes. |
| No mail adapter, throttling, JWT codec, or coverage tooling exists. | Add them during implementation with locked dependencies and per-function tests, as proposed in DESIGN/TESTS. |
| Current seed hard-codes head `0002` and inserts old token shape. | Adapt seed revision acceptance and token fixture shape during P1; do not edit immutable `0001`/`0002` snapshots or reset the populated demo. |

TTL, signing algorithm, mail transport, limiter limits and the additive schema
are proposed technical decisions, not claims about additional BA policy.
