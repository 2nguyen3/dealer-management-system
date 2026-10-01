# Authentication design and implementation decisions

**All new files/settings/schema changes here are proposed work.** Existing source
behavior is identified separately in [REQUIREMENTS.md](REQUIREMENTS.md).

## 1. Architecture and credential formats

### Service boundary

Routes validate HTTP input, inject one synchronous request-scoped SQLAlchemy
session, invoke the service, and project safe response models. Repositories execute
bound queries and acquire locks; they never commit. Mutating service operations own
commit/rollback. Authentication dependencies and the operation share the same
`get_session` dependency instance; avoid opening a second session per dependency.

Use `app.db.base.Base` and explicit `schema='dms'` ORM mappings for `AppUser`,
`UserGroup`, `AppFunction`, `GroupPermission`, `AuthToken`. Python names can be
snake_case while SQL names preserve quoted camelCase. Treat database-generated
identity/timestamps/authVersion as authoritative; `flush()`/`refresh()` or
`RETURNING` retrieves changes before creating response snapshots. Import mappings
in `alembic/env.py`; review autogenerate output for unintended changes.

Email validation checks syntax without replacing the supplied string with a
validator-normalized address; the repository performs PostgreSQL `lower(email)`
comparison. Do not use provider-specific transformations such as stripping dots
or plus-address suffixes. Existing stored user.email is used in safe responses.

Store injected `Settings` and shared adapters on `app.state` during `create_app`/
lifespan. Dependencies read those instances so factory-injected test settings are
not replaced by cached global settings. Do not require SMTP connections or DB
queries at startup. The signing key is validated at API startup, independently of
migration/seed commands that also construct `Settings`.

### Passwords

Reuse `argon2-cffi` and Argon2id, compatible with the existing demo `PasswordHasher`.
Use explicit library-recommended parameters, with real hash/verify tests. Verify
without logging password/hash. Catch the library's mismatch/invalid-hash exceptions
and fail closed with generic invalid credentials; unexpected resource/system
failures remain sanitized internal errors, not successful authentication.

For unknown login emails, verify against a precomputed dummy Argon2id hash using
the same parameters. Reveal `ACCOUNT_LOCKED` only after password verification.
Do not silently rehash at login: the SQL trigger treats hash changes as credential
version changes. Accept all nonempty passwords required by the API, including
Unicode and whitespace; no additional password-strength policy.

### Access JWT

Use maintained `PyJWT` with a fixed server-side **HS256** algorithm allowlist.
Use a backend `SecretStr` key with at least 32 UTF-8 bytes of random secret material;
examples leave it blank. Never select an algorithm from the token header or accept
`none`, an asymmetric algorithm, an unexpected key ID, or another issuer/audience.

Required claims: `sub` (positive decimal user-ID string), `sid` (UUID session ID),
`ver` (positive integer issuance authVersion), `iss`, `aud`, `iat`, `exp`,
`jti` (UUID), and `token_use='access'`. Do not embed email, password hashes, group
grants or permission lists. Enforce required claim types (including rejecting
booleans as integers), expected token use, `exp > iat`, future-issued-token checks,
signature, issuer, audience, and expiration. Proposed clock skew: 0 seconds;
`now >= exp` is expired. Codec accepts injected time for boundary tests while
keeping real signature and library verification exercised.

Default access lifetime: 900 seconds; clamp access expiry to the absolute session
expiry. Only `Authorization: Bearer <JWT>` is accepted, not cookies, query strings,
or a request-body token. Use FastAPI `HTTPBearer(auto_error=False)` so malformed/
missing headers become documented 401 rather than framework-default 403.

### Opaque refresh/reset tokens

Generate 32 cryptographically random bytes and encode as unpadded URL-safe Base64
(normally 43 characters). Store only `sha256(raw_token.encode('utf-8')).digest()`:
exactly 32 bytes. Do not use password hashing for high-entropy random tokens.
Digest the exact received string without trimming/normalization. Input contract
accepts any nonempty string; unknown token text is rejected by lookup, not by
inventing a required 43-character request format.

Refresh lifetime: absolute 604800 seconds (7 days) from login. Rotation preserves
the same `sessionId`, issuance version and absolute `expiresAt`; it does not grant
another 7 days indefinitely. Reset lifetime: 1800 seconds. Check `expiresAt <= now`
as expired. Use aware UTC instants, with test clocks synchronized to database
`clock_timestamp()` because SQL timestamp stamping controls `createdAt`.

## 2. Additive database revision

Current `auth_token` has purpose/digest/expiry/revocation but no version snapshot
or session lineage. Both are necessary to implement the source Bearer scheme's
revoked-session behavior and prevent stale refresh tokens from gaining the new
user version. Do not implement stateless JWT-only logout.

Proposed `0003_auth_sessions`, `down_revision='0002'` (recheck actual head before
implementation if another revision has landed):

| Addition | Definition / reason |
| --- | --- |
| `auth_token."authVersion"` | INTEGER NOT NULL CHECK > 0; snapshot from the owning user at issuance. No FK to mutable user version. |
| `auth_token."sessionId"` | UUID nullable; present exactly for REFRESH, NULL for PASSWORD_RESET. Stable through rotation. |
| Token shape CHECK | `(purpose = 'REFRESH') = ("sessionId" IS NOT NULL)`. |
| Session index | B-tree `("userId", "sessionId")` for session lookup/revocation. |
| One current refresh | Partial unique index on `"sessionId"` WHERE `purpose='REFRESH' AND "revokedAt" IS NULL`; old row revoked before inserting successor. Expired rows must still be revoked before replacement. |
| Token identity guard | New reviewed routine/trigger prevents updates to userId, purpose, digest, sessionId, authVersion, expiresAt; revokedAt may transition NULL→instant once, not return to NULL or change afterward. |

No new physical table; the schema remains 29 tables / 58 common timestamp columns.
Keep existing expiry/digest/FK checks and timestamp trigger. Do not add audit
triggers to tokens or copy raw reset-email payloads into SQL.

### Backfill and compatibility

1. Add nullable metadata columns within the migration transaction.
2. Read the owning user's version into every existing token. Assign a distinct
   random UUID to each existing REFRESH row; leave reset session IDs NULL.
3. Revoke every previously unrevoked token at the migration instant. There is no
   implemented HTTP token issuer today; unknown historical tokens must not become
   valid by retroactively assigning the current version. Preserve existing revokedAt.
4. Add NOT NULL/check/index/guard constraints after backfill; test on populated
   `0002` fixtures and confirm business rows and account credentials are unchanged.
5. Adapt `DemoSeed.catalog()` to insert issuance version and UUID for revoked
   refresh fixtures, NULL for reset fixtures. Replace the exact `0002` head check
   with explicit supported revision handling for `0002`/`0003` and appropriate
   insert shape, or require the new head and document that new requirement. Choose
   the new-head requirement for the implementation; tests prove upgrade precedes seed.
6. Test first seed and repeat seed at new head using disposable full-schema data.
   Do not change seeded passwords/statuses or create active demo sessions.

Downgrade in a disposable database revokes all tokens before dropping new guards,
indexes/columns; password/group/status data and old DDL objects remain intact.
Schema downgrade is not a supported way to run the new auth API. Deployment
rollback stops the auth-capable API first and requires re-login after re-upgrade.

Keep deployed `0001_initial.sql`/`0002_search_indexes.sql` immutable. New ORM mappings
do not justify regenerating tables. Update database README/DBML for the new columns
when the migration is actually implemented. The existing 54-check regression
replays only initial DDL; it remains a baseline, not evidence for revision 0003.

## 3. Transaction and session protocol

### Lock order and freshness

For token-driven mutations, first use a digest-only unlocked lookup to discover
`userId`, then lock **app_user → auth_token rows ordered by id**. Re-read token
purpose, session, version, expiry and revocation under locks before deciding.
The initial lookup never authorizes the operation. All account/session writers,
including future administration services, use the same user-first protocol.

SQLAlchemy identity-map objects may have been loaded by a dependency before a
lock wait. Use `populate_existing=True`, `refresh()` under lock, or explicit
fresh projections so an expired/stale cached object never passes revalidation.
Credential verification/hashing can be performed before acquiring locks, but
then compare the locked current hash/version and revalidate before writing.
Do not hold a row lock across SMTP/network calls.

Set audit context in the write transaction with bound `set_config(..., true)`:
`dms.actor_id`, `dms.request_id`, `dms.function_code`. Reset completion is SYSTEM
(empty actor ID); self-change is USER. Both use registered `users.manage` for
classification. This is not granting self-service callers account-admin rights.
Do not manually add duplicate audit snapshots; the app_user trigger writes them.

All service failures roll back. A response snapshot may be composed before commit,
but raw tokens/success may only be returned after commit succeeds. Do not implicitly
nest `session.begin()` after dependency reads have already started a transaction.
Use explicit service-owned commit/rollback over the existing transaction.

### Login

1. Validate request and rate-limit before expensive hashing.
2. Find user via `lower(email)` bound lookup. Perform password or dummy verification.
3. Wrong/unknown credentials: 401, no write. If password valid, lock/reload user;
   recheck unchanged credential/version; LOCKED gives 403, no issuance.
4. Generate session UUID, refresh token/digest, access JWT and absolute expiry.
   Store REFRESH row with current authVersion. Load safe user/group projection.
5. Commit, then return documented token response with no-store headers.

### Refresh

1. Find token owner, lock user then token; wrong purpose/unknown gives 401.
2. A known REFRESH token for LOCKED user gives 403; otherwise require unrevoked,
   unexpired token with token.authVersion equal to user.authVersion.
3. Revoke old token, flush, create successor with same session UUID/version/expiry,
   create new access JWT and response projection; commit atomically.
4. Concurrent loser re-reads revoked row and returns 401. Replay does not revoke
   the successful successor; token-family compromise detection is not in this API.

### Live access authentication and `/auth/me`

After JWT verification, load user and a live REFRESH row for `(userId, sid)`.
Check ownership/purpose before exposing lock state. LOCKED gives 403 for a known
session; ACTIVE requires JWT ver = token ver = current user ver, unrevoked current
refresh, and `expiresAt > now`. A missing/expired/revoked session gives 401.
This database lookup occurs on every protected request; no stale principal cache.

Refresh rotation retains `sid`, so previous unexpired access JWTs stay valid in
that live session. Logout ends that session; password changes end all sessions.
`/auth/me` loads allowed function codes from current group grants with isAllowed
true; empty grants return an empty list, not admin defaults.

### Logout

Look up supplied REFRESH digest even if the row was consumed by rotation. If known,
lock its user and re-read it, then revoke all currently unrevoked REFRESH rows in
its `(userId, sessionId)` lineage. Historical tokens remain for lookup/history.
If unknown, wrong-purpose, expired or already logged out, return empty 204 without
revealing identity. A known expired lineage may be revoked as cleanup. Commit any
revocation before success. Other devices/sessions are unaffected. Do not purge
historical rows in this module; a future retention policy must preserve required
lineage lookup for its documented period.

### Password change / reusable invalidation

Authenticate access bearer, lock/reload user, revalidate live session and current
password, hash new password and update `passwordHash`. Retrieve the SQL-triggered
new authVersion, revoke **all** unrevoked REFRESH and PASSWORD_RESET rows for that
user, commit, return empty 204. The caller must log in again; do not issue tokens.
Even changing to the same plaintext produces a salted new hash and invalidation.
Reusable `invalidate_user_sessions()` revokes tokens after future group/status/
admin-password updates in their same transaction, without independently committing.
Direct SQL updates still invalidate access/refresh by version comparison even if
they did not call that helper. Email/fullName edits alone do not bump the existing
SQL trigger; do not invent invalidation for those edits.

### Request password reset and delivery

Use standard-library SMTP over STARTTLS or implicit TLS, behind an injected adapter.
The reset URL is a configured frontend URL plus token in the **fragment**, not a
logged query string. The future frontend reads the fragment and POSTs the token
to `/auth/password-resets`. SMTP receives the raw token only in the mail body;
SQL stores its digest. Never print/reset-token URLs for a development fallback.

1. Validate email and apply identical limiter buckets to known/unknown/locked accounts.
2. Check adapter/configuration availability independently of account lookup. A
   globally disabled/unavailable adapter returns 503 + Retry-After for every email.
3. Missing/LOCKED account: no token/mail, return the common 202 response.
4. ACTIVE account: lock/recheck, revoke earlier PASSWORD_RESET rows, store new
   reset digest/version, commit. Read stored email as recipient, not an arbitrary
   caller-supplied destination. Revalidate version/status under lock after waiting.
5. Send through SMTP after commit with a bounded timeout. A transient recipient/
   transport rejection is recorded only as a sanitized internal event, the newly
   issued token is revoked in a separate compensation transaction, and the caller
   still gets the same 202. Do not return account-dependent 503 after lookup.
6. If compensation fails, log a safe failure indicator without credentials; expiry
   still limits the committed token. If delivery outcome is unknown, treat it as
   failure and revoke: a possibly delivered link may be unusable, never an unlock.

This is a synchronous course-project delivery design, not a durable mail queue.
A process crash between commit and send may leave an undelivered expiring token;
the user retries and the earlier reset token is revoked. Do not claim durable
delivery. No provider call happens while holding the account lock.

Return account-independent text/body/status for active/missing/locked/send-failure.
Use a common response-duration floor with injected monotonic clock/sleeper, longer
than the configured SMTP timeout, across these outcomes. The limiter protects
the padding cost; test the padding logic without real sleeps. Record measured
timing limitations under actual load rather than claiming perfect indistinguishability.

### Complete token reset

Lookup/lock user and PASSWORD_RESET row; require purpose, current issuance version,
expiry, and no revokedAt. Do not require ACTIVE status, because the API explicitly
says reset never unlocks. Hash/update password, retrieve new version, revoke all
refresh/reset tokens including this one, set SYSTEM audit context, commit, 204.
No automatic login, no status edit. Two concurrent consumes: one 204, one 401.
Password change and reset serialize under the same user lock.

## 4. RBAC integration seam

`require_permissions(all_of=..., any_of=...)` authenticates first, then evaluates
current DB function codes. Every allOf member must be granted; when anyOf is
nonempty at least one member must be granted; if both are supplied both conditions
must hold. Reject unknown function codes and an empty policy at construction so
a typo cannot create an unguarded business endpoint. Missing/false grants deny.

Use the existing 33 codes, not a hardcoded MANAGEMENT bypass. Management's current
permissions are data and can be revoked. `/auth/me`/self-password do not require
`users.manage`. Business route modules later attach policies from `x-permissions`;
use a test-only protected route to verify the dependency now, without creating
placeholder business endpoints. Chatbot tools later reuse the same checks.

Permission updates do not bump app_user.authVersion in existing SQL. Read grants
on each request so a group permission change affects the next request immediately.
No process-level permission caching. Mutating services revalidate authentication
after obtaining locks; requests already admitted before a concurrent revocation
are not retroactively canceled. Test the next-request contract explicitly.

## 5. HTTP plumbing, errors and throttling

Generate a UUID-based request ID per request; do not trust a client value as SQL
actor/function context. Middleware stores it on request state and attaches
X-Request-Id. Auth errors use a typed domain error translated into the source
Error schema. Sanitize Pydantic validation: never serialize `input`, `ctx`, raw
exception strings, body bytes or password/token values. Map malformed JSON to 400,
unsupported/missing JSON media type on body routes to 415, semantic/extra/type/
missing-field failures to 422. Support `application/json` with charset parameters.
Response-schema failure/SQLAlchemy/unexpected exceptions give safe 500.

Scope error translation to auth routes/explicit auth errors; preserve existing
health readiness response/tests. HTTP handlers must declare the exact seven
operation IDs, request models, responses and security metadata in runtime OpenAPI.
Allow/expose X-Request-Id and expose Retry-After/WWW-Authenticate through CORS as
needed by the client. Credentials remain disabled because this API uses headers
and JSON tokens, not cookies.

Initial limiter: bounded in-memory rolling-window buckets, protected by a thread
lock, monotonic time, eager expired-key cleanup and deterministic injectable clock.
Application-factory-local state prevents tests/apps sharing buckets. Proposed
limits (technical defaults, configurable):

| Bucket | Proposed limit/window |
| --- | --- |
| Every auth operation, per client address | 120 / 60 seconds |
| Login, per address + case-insensitive email | 10 / 60 seconds |
| Reset-email requests, per address + case-insensitive email | 3 / 900 seconds |
| Reset completion, per address | 10 / 60 seconds |

Use fixed safe operation labels and an HMAC/digest email component; no raw password/
token in keys/logs. Bound bucket count (default 10,000); if capacity is full with
live buckets, reject new keys with 429 instead of evicting live protection.
Retry-After is `ceil(remaining_window)` with minimum 1. Simultaneous requests must
not admit more than the limit. Throttling does not change account LOCKED status.

Trust `request.client` by default. Forwarded-header trust must be explicitly
restricted to the known reverse proxy; do not trust arbitrary X-Forwarded-For from
the public client. Verify direct localhost API and Nginx paths; without a trusted
proxy configuration, limiter safely buckets Nginx traffic together and this limitation
must be documented. Deployment remains one worker/replica for this limiter. Scaling
requires shared atomic storage; do not claim multi-worker throttling is complete.

## 6. Proposed settings and dependencies

| Setting | Proposed default/validation |
| --- | --- |
| `AUTH_SIGNING_KEY` | SecretStr, blank example; required >=32 bytes for auth-capable API startup, not DB-only CLI commands. |
| `AUTH_ISSUER` / `AUTH_AUDIENCE` | `agentra-api` / `agentra-ui`, nonempty. |
| `AUTH_ACCESS_TTL_SECONDS` | 900, positive and <= refresh TTL. |
| `AUTH_REFRESH_TTL_SECONDS` | 604800, positive. |
| `AUTH_RESET_TTL_SECONDS` | 1800, positive. |
| `AUTH_RATE_LIMIT_MAX_BUCKETS` | 10000, positive; expose the four limits/windows above as validated positive settings. |
| `AUTH_RESET_RESPONSE_FLOOR_SECONDS` | 6, greater than SMTP timeout; injected in tests. |
| `AUTH_RESET_URL` | Required for enabled mail; absolute configured http(s) frontend URL with no existing fragment; HTTPS for deployed public use. |
| `AUTH_MAIL_ENABLED` | false; disabled reset requests return account-independent 503. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` | Required when enabled; valid host/port/sender. |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | Optional paired credentials; password SecretStr; blank examples. |
| `SMTP_TLS_MODE` | `starttls`; allow `starttls` or `ssl`; plaintext only in an explicit local-test adapter, not the deployment adapter. |
| `SMTP_TIMEOUT_SECONDS` | 5, positive, below reset response floor. |

Settings validators must exercise enabled/disabled combinations and secret-safe
representations. Add key validation as an API-startup function so Alembic/seed
do not require an API signing key. Health unit fixtures receive a synthetic test
key once the API includes auth; application liveness still makes no DB query.

Runtime additions: `PyJWT`, `email-validator` for Pydantic email validation.
Dev additions: `pytest-cov`, `jsonschema` for OpenAPI 3.1 response-validation tests.
SMTP uses the standard library. Update `pyproject.toml` and `uv.lock` together;
then verify a frozen install. Record actual compatible versions during implementation
rather than specifying an unverified lock resolution in this plan.

## 7. Documentation and operational integration

When implementing, update backend `.env.example` without signing/SMTP/DB secrets,
backend README/AGENTS, root README, database README/DBML, and the shared verification
workflow for integration markers/coverage commands. Align the source OpenAPI only
for reviewed clarifications; do not rewrite unrelated business operations.

Test API docs, liveness/readiness, direct login and proxied login, no-store headers,
reset-email capture and credential invalidation. Run migrations explicitly before
starting the API. No migrations, ORM create_all, token purge or seed on API startup.
Authentication schema upgrade must be present before an auth-capable API serves
traffic. Missing schema becomes a safe failure, never auth bypass.
