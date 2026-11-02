# Authentication strict test specification

**Status:** executable suites implemented and locally verified. The minimum-case
inventory below is preserved; the actual-symbol register in §8 is authoritative
for implemented names/test ownership. Exact passing commands are in VERIFICATION.

## 1. Rules for each completed function

1. Test the real function, not a duplicate of its implementation. Assert output,
   externally meaningful effects, invalid inputs, boundaries and failure recovery.
2. Cryptographic helpers use the real Argon2/JWT libraries. Only clock/randomness
   boundaries and external adapters may be controlled; never mock verification
   to prove invalid credentials or signatures are rejected.
3. Repository/transaction/constraint/lock behavior requires real PostgreSQL.
   Offline service tests are useful but do not replace integration evidence.
4. HTTP tests verify source schemas, complete status/body/header behavior and
   dependency wiring. Do not override the auth service in the full lifecycle tests.
5. Each introduced production helper, validator, adapter method, route or nested
   dependency has its own register entry or clearly identified subentry with tests.
   Mappings/configuration without callable behavior have dedicated structural tests.
6. No required function/case can be closed on a skipped, xfailed or unrun test.
   Keep incomplete items unchecked; failures and blockers go into VERIFICATION.
7. 100% statement/branch coverage of auth-owned behavior plus passing scenarios;
   no coverage exclusions for reachable failures. Review each conditional's tests.

## 2. Function-level register

Each row lists **minimum cases**, not a limit on additional necessary tests.
`U` = isolated unit, `H` = HTTP with real auth collaborators/fakes for external I/O,
`D` = real PostgreSQL, `C` = multiple independent connections.

| ID | Proposed symbol / responsibility | Mandatory assertions | Layer / target test file |
| --- | --- | --- | --- |
| F01 | Settings auth validators / `validate_auth_startup_settings` | Blank/short key rejected at API startup; DB-only settings load without key; positive TTL/order/limits; enabled-mail missing fields rejected; paired credentials/TLS/URL validated; repr/errors redact secrets; factory uses injected config. | U `tests/auth/test_settings.py` |
| F02 | Auth request schema validators | Required/missing/extra/null/non-string/empty fields; valid/invalid email and whitespace; password spaces/Unicode preserved; unknown nonempty opaque text accepted for lookup; no coercion; validation errors contain no values. | U/H `test_schemas.py`, `test_http_errors.py` |
| F03 | `hash_password` | Argon2id prefix; real round-trip including Unicode/one-character/whitespace; random salts differ; no plaintext exposure; resource failure propagated safely. | U `test_passwords.py` |
| F04 | `verify_password` | Correct/incorrect/empty caller input; malformed/truncated/unsupported hash fail closed; dummy unknown-user verification path; no implicit rehash/write; unexpected system failure not converted to success. | U `test_passwords.py` |
| F05 | `generate_opaque_token` | Uses cryptographic byte source with 32 bytes; URL-safe unpadded output; independent samples differ; generation failure cannot issue session. | U `test_tokens.py` |
| F06 | `digest_opaque_token` | Independent SHA-256 known vector, bytes length 32; exact input encoding; no trimming; digest differs for whitespace/case; digest only stored. | U/D `test_tokens.py`, `test_persistence.py` |
| F07 | `encode_access_token` | Real library validates signature/claims; string bigint sub, UUID sid/jti, integer ver; issuer/audience/token_use; UTC expiry and session-expiry clamp; deterministic clock cases; no secrets/group grants in payload. | U `test_tokens.py` |
| F08 | `decode_access_token` | Valid JWT; tampered/wrong-key/none/wrong-alg/issuer/audience; missing/wrong-type/boolean claims; invalid sub/sid/jti/ver/token_use; expiry just before/at/after; future iat; malformed encodings; no exception-secret leaks. | U `test_tokens.py` |
| F09 | `to_user_response` | Exact safe fields/camelCase; bigint > JS safe integer becomes exact string; group fields integer ID; UTC timestamps; no lazy access after session closes; no hash/version/digest leak. | U/D `test_schemas.py`, `test_persistence.py` |
| F10 | `find_user_by_email` | Lowercase/mixed-case lookup identical; unknown returns None; uses bound parameter, SQL-injection text cannot match all users; CI unique index remains enforced. | D `tests/integration/auth/test_repository.py` |
| F11 | `get_user_with_group` | Correct identity/group projection; missing user/group fails closed; required quoted column names and joined fields; group changes reflected after refresh. | D `test_repository.py` |
| F12 | `find_token_owner` | Known digest finds owner without authorizing; unknown absent; reset/refresh distinguishable; no raw token stored; wrong-purpose does not authorize. | D `test_repository.py` |
| F13 | `lock_user` | SELECT FOR UPDATE serializes competing writers; reloads stale identity-map object after wait; missing user handled; no independent commit. | D/C `test_repository.py`, `test_concurrency.py` |
| F14 | `lock_token` | Purpose/digest-bound locked row; re-read after wait sees revoked state; user-first lock order; cross-user mismatch fails; no independent commit. | D/C `test_repository.py`, `test_concurrency.py` |
| F15 | `insert_token` | All metadata/digest/UTC expiry persists; generated timestamps retrieved; invalid version/session/purpose/digest/expiry/duplicate rejected; raw token absent; no commit by repository. | D `test_persistence.py` |
| F16 | `revoke_session` | Current lineage revoked including logout using consumed ancestor; unrelated session/user/reset untouched; repeated revocation does not overwrite timestamps; access lookup fails afterward. | D `test_sessions.py` |
| F17 | `revoke_user_tokens` | All requested purposes revoked for owner only; existing revoked timestamps unchanged; empty set no-op; outstanding resets and refreshes invalidated together; repository never commits. | D `test_repository.py` |
| F18 | `update_password_hash` | New hash persists; SQL trigger bumps version exactly once; response reload sees version; same plaintext/new salted hash still invalidates; status/email/group preserved; rollback restores old state. | D `test_password_workflows.py` |
| F19 | `get_allowed_function_codes` | True only, deduplicated deterministic list; missing/false deny; current group only; MANAGEMENT has no bypass; database grant changes appear on next read. | D `test_permissions.py` |
| F20 | `invalidate_user_sessions` | Called in caller transaction after group/status/admin-password update; revokes all purposes without second version bump/own commit; rollback preserves prior tokens; direct SQL version bump also invalidates even without helper. | D/C `test_invalidation.py` |
| F21 | `login` service | ACTIVE success/persisted digest/session; unknown/wrong password generic 401, dummy verification; valid LOCKED credentials 403; no issuance on failure; concurrent password/status change cannot mint stale authorized tokens; signing/insert/commit failure rolls back. | U/D/C `tests/auth/test_login.py`, integration `test_sessions.py` |
| F22 | `refresh_tokens` service | Success rotates once preserving sid/version/absolute expiry; old token 401; wrong purpose/unknown/revoked/expired/version mismatch 401; LOCKED known session 403; failed insert/sign/commit leaves old token usable; parallel one winner; old access survives rotation until logout. | D/C `test_sessions.py`, `test_concurrency.py` |
| F23 | `logout` service | Known/current/ancestor/expired/revoked/unknown/wrong-purpose all appropriate empty-success behavior; only matching lineage revoked; repeated call stable; rollback on commit failure, no false 204; parallel refresh cannot leave live successor after logout commits. | D/C `test_sessions.py`, `test_concurrency.py` |
| F24 | `get_current_user` service | Live safe user and current grant list; zero grants permitted; current profile change reflected; session missing/wrong user/version/expiry/revocation fails closed; locked status behavior. | U/D `tests/auth/test_current_user.py`, integration `test_permissions.py` |
| F25 | `change_password` service | Valid current password -> new hash/version, all sessions/resets invalid, no issued tokens; wrong current password no writes; lock/version recheck after wait; same plaintext invalidates; audit and hash rollback on failure. | D/C `test_password_workflows.py`, `test_concurrency.py` |
| F26 | `request_password_reset` service | Identical 202 body for active/missing/locked/send failure; new digest only for active; prior reset revoked; recipient from DB; no token returned; no lock during SMTP; globally disabled 503 for every email; failed send compensation; failed compensation safe event; injected padding for each outcome. | U/D `tests/auth/test_reset_requests.py`, integration `test_password_workflows.py` |
| F27 | `reset_password_with_token` service | Valid once -> hash/version/all-token revocation/204; wrong-purpose/unknown/stale/revoked/expiry 401; locked-but-current-version token resets without unlocking; no auto-login; two consumes one winner; rollback keeps token/password unchanged. | D/C `test_password_workflows.py`, `test_concurrency.py` |
| F28 | Auth error/validation exception handlers | Exact source Error shape/codes/headers; malformed JSON 400 vs semantic 422; media type 415; 401 WWW-Authenticate; 429 Retry-After; safe SQL/SMTP/Argon2/unexpected 500; validation input/ctx removed; health payload preserved. | H `tests/auth/test_http_errors.py` |
| F29 | `get_current_principal` dependency | Header bearer only; missing/malformed/wrong scheme 401; query/body/cookie token ignored; cryptography and DB session checked; no bypass through TestClient wiring; factory settings reused; no duplicate DB session. | H/D `test_dependencies.py`, integration `test_http_lifecycle.py` |
| F30 | `require_permissions` plus returned dependency | allOf/anyOf/combined truth tables; empty/unknown policy rejected; absent/false grants 403; auth failures before permission failure; MANAGEMENT denial honored; permission update affects next request. | U/H/D `test_dependencies.py`, integration `test_permissions.py` |
| F31 | Request-ID middleware / `set_audit_context` | Safe generated ID matches header/body/audit; client cannot supply actor/function; bound transaction-local values; SYSTEM actor clears prior actor; second pooled connection/request has no leaked context; rolled-back write has no committed audit. | H/D `test_request_context.py`, integration `test_audit.py` |
| F32 | `build_reset_link` | Configured origin/path preserved; fragment token correctly encoded; no query token; existing fragment rejected; recipient/host cannot be injected from request; no logs of URL. | U `test_delivery.py` |
| F33 | Mail adapter availability method | Enabled/configured available without recipient lookup; disabled/outage decision consistent for all emails; no connection on app startup; safe failure representations. | U/H `test_delivery.py`, `test_reset_requests.py` |
| F34 | `SmtpResetDelivery.send` and response-padding helper | Correct envelope/template/link; TLS before login/send; implicit TLS path; bounded timeout; cleanup on success/failure; reject header injection; no raw credentials in logs; local SMTP sink captures message; padding computes remaining floor with injected clock/sleeper, never negative sleep. | U/D-adapter `test_delivery.py`, integration `test_delivery.py` |
| F35 | `build_rate_limit_key` | Fixed operation/client-address scope; email CI bucket; no email/token/password in emitted key/log; client-supplied forwarded headers cannot spoof trusted address; known/missing account identical key construction. | U/H `test_rate_limit.py` |
| F36 | `AuthRateLimiter.check` | N allowed, N+1 rejected; positive ceil Retry-After; exact reset boundary; clock monotonic; thread concurrency; independent app/bucket isolation; expired cleanup; max capacity rejects new buckets without evicting live protections. | U/H `test_rate_limit.py` |
| F37 | `login` route | A01/A08; correct operationId/security/models; real service issuance in lifecycle; no success before commit; no extra response fields. | H/D `test_http_contract.py`, integration `test_http_lifecycle.py` |
| F38 | `refreshTokens` route | A02/A08; no access bearer required; old refresh rejects; correct body/headers and service wiring. | H/D same targets |
| F39 | `logout` route | A03/A08; no access bearer required; repeated/unknown tokens 204 zero bytes; error on failed commit safe 500. | H/D same targets |
| F40 | `getCurrentUser` route | A04/A08; bearer required; safe projection/current grants; source-required statuses; no admin permission required. | H/D same targets |
| F41 | `changePassword` route | A05/A08; required bearer/current password; 204 empty; caller/other sessions subsequently invalid; no self-admin grant requirement. | H/D same targets |
| F42 | `requestPasswordReset` route | A06/A08; same 202 across identities; safe 503 only global availability; no bearer required; no reset token in payload. | H/D same targets |
| F43 | `resetPasswordWithToken` route | A07/A08; no bearer required; one-use 204 then 401; locked status never changed; no 403 added. | H/D same targets |
| F44 | Migration `upgrade` / new token guard routine | Populated/fresh upgrade; backfill/revocation; constraints/index/immutable columns; stamp trigger compatible; unchanged account hashes/business rows; idempotent `upgrade head`; seed at new head works twice. | D `test_migrations.py`, `test_seed_compatibility.py` |
| F45 | Migration `downgrade` | Disposable database only; tokens revoked first; new objects removed, old shape/data/FKs preserved; re-upgrade valid; no edit to deployed snapshots. | D `test_migrations.py` |
| F46 | Seed integration modifications | New auth metadata shape and head guard; revoked-only tokens; old demo credentials/statuses/counts stable; repeated seed does not append/overwrite. | D `test_seed_compatibility.py` |

Track additional actual methods/validators introduced in implementation as F47+
or explicit named subentries. Declarative ORM mapping tests are D02 even where no
production method exists. Existing `create_app`, router mounting, and config
loading changes receive F01/F29/F37–F43 and H08 regression coverage.

## 3. HTTP acceptance matrix

Use the source OpenAPI schemas with a local reference registry and Draft 2020-12
validator with format checking. Validate actual responses against the referenced
schema, not an independently authored reduced schema. Explicitly assert safe User
field whitelist too, because its source schema does not forbid additional fields.
Do not compare runtime's entire spec to the design document: unimplemented business
paths are expected to be absent. Compare all seven auth operations and reachable
auth components/headers/statuses/security/operation IDs.

| Case | Requests / assertions |
| --- | --- |
| A01 | Mixed-case email + correct password -> 200 source TokenResponse; unknown/wrong -> 401 same message; valid locked -> 403; no refresh record on failures. |
| A02 | Refresh -> 200 different token same sid, old token -> 401, expiry/version/wrong-purpose -> 401, known locked -> 403; tokens no-store and request ID. |
| A03 | Logout -> 204 body empty, same/unknown token again -> 204; access JWT from logged-out session -> 401; another session works; consumed ancestor logout ends current lineage. |
| A04 | Me -> 200 correct string user ID/group/grants; absent/invalid bearer -> 401 WWW-Authenticate; known locked -> 403; newly revoked grant absent immediately. |
| A05 | Password PUT -> 204, new login works/old password fails, caller and second-device access/refresh fail; wrong current password -> 401 without mutation; one-character/space password accepted. |
| A06 | Reset-email POST active/missing/locked -> identical 202 AcceptedMessage; only active mail captured; disabled globally -> 503 for all; no reset token/hash/raw email in errors/logs; isolated recipient failure still 202. |
| A07 | Reset POST valid -> 204 once, replay -> 401; stale/expired/refresh token -> 401; hash changes and all old sessions fail; locked current-version fixture remains locked. |
| A08 | Parameterize six body routes: missing JSON media / form -> 415, invalid JSON -> 400, missing/extra/null/type/empty data -> 422; all seven throttled -> 429 with Retry-After; internal/commit errors -> sanitized 500. Request IDs and source error shape checked every time. |
| H08 | Existing health tests still pass; docs route works; source auth operations generated; public routes/health not accidentally bearer-protected; injected Settings used; CORS preflight and exposed request/retry/auth headers verified. |

## 4. PostgreSQL / security cases

| Case | Mandatory real-state assertions |
| --- | --- |
| D01 | Migration: empty database upgrade and populated 0002→new head; backfilled rows never become live; supported token shape/index/guard; downgrade/re-upgrade in disposable DB. |
| D02 | ORM table/schema/SQL-column names, identities, timezone-aware timestamps, group/function joins; no autogenerate deletion of unmanaged DMS/Supabase objects. |
| D03 | Direct SQL password/group/status change increases authVersion and invalidates old access/refresh/reset; version cannot decrease; permission-only change does not require new JWT. |
| D04 | Password self-change USER actor; token reset SYSTEM actor; functionCode users.manage; request correlation; immutable audit; no passwordHash/tokenDigest/plaintext/credential links. |
| D05 | Inject failure at insert, signing, flush and commit; rollback preserves old refresh/password/reset validity and leaves no half-issued successor or audit; no successful HTTP response before commit. |
| P01 | Initial four groups match versioned DDL grants (33 registry codes); MANAGEMENT granted by data, not bypass; sales/warehouse/accounting selected allowed/denied routes via test-only guarded endpoint. |
| P02 | allOf/anyOf/both truth tables; missing grant false; unknown policy denied at definition; group change invalidates session, while grant change alters next request without token reissue. |
| P03 | Current permissions read through same principal/session; one user's grants never leak into another; chatbot integration seam returns the same decision without implementing chatbot business reads. |
| S01 | Sentinel raw passwords/JWT/refresh/reset tokens/hashes absent from captured logs, HTTP error/response fields except intended token success fields, audit and SQL rows except designated hash/digest columns. Include exception strings and validation bodies containing sentinels. |
| S02 | Reset enumeration: identical status/message/schema and limiter handling for known/unknown/locked/failure; padding tested with fake time. Globally unavailable adapter returns 503 independent of identity. Measure actual timing separately; do not use flaky millisecond thresholds as correctness tests. |
| S03 | Signing/purpose/claim manipulation, query/cookie bearer bypass, SQL-injection email, malformed header, SMTP header injection, forwarded-header spoof, cross-user sid and reset/refresh cross-use all fail safely. |

## 5. Concurrency tests (independent connections)

Use barriers/events and real PostgreSQL locks, not sleeps to guess ordering. Fixtures
for these tests must be committed in a disposable test DB so both connections can
see them. Clean up the entire disposable DB/schema after connections close.
Assert final persisted state as well as response counts.

| Case | Interleaving / required outcome |
| --- | --- |
| C01 | Two refreshes use same token: exactly one 200, one 401; one unrevoked successor, old revoked; successor JWT authenticates. |
| C02 | Refresh vs logout (test each lock winner): after logout completes no lineage refresh/access valid, including a successor committed before logout; unrelated sessions work. |
| C03 | Login/refresh vs password/group/status update: token issued before update becomes unusable; update-first reload sees new hash/status/version; no stale cached object creates an authorized session. |
| C04 | Two reset consumes: one 204, one 401, one committed password/version change; no unlocked status or live old session. |
| C05 | Reset vs password change and two reset requests: serialized user updates; stale issuance version rejected; at most one current reset token after requests; no half-written hash/audit. |

Use lock/statement timeouts to fail deadlocks deterministically; make failed tests
close/rollback both connections. An ambiguous network failure at commit cannot be
claimed to prove rollback: final DB state must be inspected. Fault-injection
rollback tests use a definite transaction failure, distinct from unknown outcomes.

## 6. Harness and isolation plan

- Offline tests use `Settings(_env_file=None, ...)`, synthetic signing key, fake
  delivery, injected UTC/monotonic clocks and app-local limiter. Disable throttling
  by explicit high test limits in non-limiter tests, not a hidden bypass in code.
- `TestClient` runs lifespan; test full routes with real services and deterministic
  repository fakes offline, plus real DB for lifecycle/rollback integration.
- Add `integration` pytest marker. Default `uv run pytest` selects offline tests;
  integration suite explicitly selects the marker. Selecting offline tests is not
  evidence that integration cases passed.
- Integration reads **test-only** `AUTH_TEST_DATABASE_URL`, with a guard rejecting
  the configured runtime database and requiring an unmistakable disposable test DB
  name. Never fall back to `DB_*`/backend `.env` when test URL is missing.
- A specifically requested integration run without this prerequisite **fails setup**,
  rather than silently skipping. Alembic tests inject connection/URL for the test
  database; do not run root migration commands against demo data as test fixtures.
- Apply actual reviewed migrations. Sequential test sessions may use an outer
  transaction/savepoints, provided service commit behavior is tested separately.
  Race tests require committed fixtures and multiple real sessions; SQLite cannot
  substitute for PostgreSQL FK/check/trigger/lock behavior.
- Use a local SMTP capture server for adapter integration; fake mail tests do not
  prove TLS/transport integration. No real customer addresses/provider calls in CI.
- Freeze clock around PostgreSQL-derived timestamps appropriately; do not insert
  a token whose expiresAt is before SQL-stamped createdAt just to simulate expiry.
  Advance the validation clock after insertion instead.

## 7. Required implementation commands

Run from `backend/`. Paths, coverage tooling, integration markers and disposable
URL handling are implemented. Keep original checks.

```sh
uv sync --frozen
uv run ruff check .
uv run ruff format --check .
uv run pytest -m "not integration"
uv run pytest --cov=app.modules --cov=app.common --cov=app.core --cov=app.api --cov=app.db.base --cov=tests.support --cov-branch --cov-report=term-missing
uv run pytest tests/integration/auth tests/integration/shared_api tests/integration/user_groups -m integration --cov=app.modules --cov=app.common --cov=app.core --cov=app.api --cov=app.db.base --cov=tests.support --cov-branch --cov-append --cov-report=term-missing --cov-report=json --cov-fail-under=100
```

The combined scope now includes M02/M03; configure both guarded auth and business
test URLs. See the [verification workflow](../../../../.agents/workflows/verify.md).
Use the function's focused test file/node IDs before recording completion. At P6,
combine offline and integration coverage as above. Inspect JSON per-file coverage
to ensure every scoped file has 100% statements and branches, not just aggregate
rounding to 100. Add coverage targets for auth behavior moved to other files.
SMTP integration is included in the integration selection with its local-sink
prerequisite. Record exact environment and commands, never credentials.

In an explicitly configured disposable/full demo verification environment:

```sh
uv run alembic upgrade head
uv run alembic current
uv run python -m app.db.seed
uv run python -m app.db.seed
uv run python -m app.db.verify --seeded --regression
```

Existing `--seeded` verification checks original demo passwords/statuses. Run it
**before** any manual auth smoke that changes demo credentials, or use separate
synthetic auth fixture users. The existing 54 checks exercise baseline DDL only;
new migration/session tests are required in addition.

Repository-root documentation/Compose checks when relevant:

```sh
git diff --check
docker compose --profile tools config --quiet
```

Compose validation requires the actual configured backend `.env`. Do not print
resolved secret-bearing configuration. Proxied/direct API and external deployment
mail smoke evidence must be recorded separately from static config success.

## 8. Actual-symbol and executable-case register

Prefixes: `A = app.modules.auth`, `C = app.core`, `R = app.common.responses`; test paths below are
relative to `backend/tests/`. Each named constructor/helper/nested dependency is
included; declarative mappings/typed registry have structural/source-contract tests.
F01 includes existing integration points changed for auth. Failure tests use real
crypto/HTTP, definite fault injection and persisted PostgreSQL state as applicable.

| IDs | Actual symbols | Passing test files / principal test nodes |
| --- | --- | --- |
| F01 | `C.config.Settings.validate_auth`, `validate_auth_startup_settings`, `Settings.database_url`, `get_settings` | `auth/test_primitives.py::test_startup_key_and_db_only_settings`, `test_invalid_settings`, `test_enabled_mail_settings_and_secret_safe_failures`, `test_cached_settings_loader_uses_environment`; baseline `test_config.py` |
| F02 | `A.schemas.EmailRequest.valid_email` | `auth/test_primitives.py::test_strict_schema_preserves_input`, `test_strict_schema_rejects_without_echo`; `auth/test_http.py::test_all_body_routes_safe_errors` |
| F03–F04 | `C.security.hash_password`, `verify_password` | `auth/test_primitives.py::test_real_password_round_trip`, `test_bad_hash_fails_closed`; `auth/test_failure_boundaries.py::test_crypto_resource_failure_propagates`; real login/password suites |
| F05–F06 | `A.tokens.generate_opaque_token`, `digest_opaque_token` | `auth/test_primitives.py::test_opaque_tokens_exact_digest`; resource-failure test; persisted token/digest assertions in `integration/auth/test_sessions.py` |
| F07–F08 | `A.tokens.encode_access_token`, `decode_access_token` | `auth/test_primitives.py::test_access_round_trip_and_expiry`, `test_claim_manipulation`, `test_fractional_session_expiry_rejected`; JWT header/key/future/missing-claim tests in `auth/test_failure_boundaries.py`; `integration/auth/test_sessions.py::test_fractional_refresh_failure_preserves_original` |
| F09 | `A.schemas.to_user_response` | `auth/test_primitives.py::test_permission_response_uniqueness_and_bigint`; safe whitelist and source response validation in `integration/auth/test_http_lifecycle.py` |
| F10–F14 | `A.repository.AuthRepository.find_user_by_email`, `AuthRepository.get_user_with_group`, `AuthRepository.find_token_owner`, `AuthRepository.lock_user`, `AuthRepository.lock_token` | `integration/auth/test_sessions.py::test_repository_queries_and_caller_owned_invalidation`; CI uniqueness test in `test_permissions_audit.py`; stale identity-map and actual user-first wait tests in `test_concurrency.py` |
| F15–F18 | `AuthRepository.insert_token`, `AuthRepository.revoke_session`, `AuthRepository.revoke_user_tokens`, `AuthRepository.update_password_hash` | `integration/auth/test_sessions.py` lifecycle/password/rollback tests; `test_migrations.py` schema/revocation/identity checks; no independent repository commit |
| F19–F20 | `AuthRepository.get_allowed_function_codes`, `A.service.invalidate_user_sessions` | `integration/auth/test_permissions_audit.py::test_initial_group_permissions_are_data`, `test_case_insensitive_uniqueness_and_missing_grants`, `test_direct_sql_hash_group_and_profile_semantics`; caller-owned rollback and races in `test_sessions.py`/`test_concurrency.py` |
| F21–F24 | `A.service.AuthService.login`, `AuthService.refresh_tokens`, `AuthService.logout`, `AuthService.get_current_user` | `integration/auth/test_sessions.py` invalid/locked/rotation/logout/expiry/state/commit-failure cases; C01–C03 in `test_concurrency.py`; live grant/profile cases in `test_permissions_audit.py` |
| F25–F27 | `AuthService.change_password`, `AuthService.request_password_reset`, `AuthService.reset_password_with_token` | `integration/auth/test_sessions.py` persisted/audit/locked/reset/replay/send-compensation/same-password/expired-reset/rollback cases; C04–C05 in `test_concurrency.py`; privacy HTTP cases in `test_http_lifecycle.py`; no SMTP under locks in `test_permissions_audit.py` |
| F28 | `C.exceptions.AuthError.__init__`; `R.auth_error_response`, `auth_error_handler`, `http_error_handler`, `validation_error_handler` | `auth/test_http.py` all body/media/error/status/header cases, invalid UTF-8 and safe 500; non-auth compatibility in `auth/test_failure_boundaries.py`; baseline health tests |
| F29 | `A.dependencies.get_auth_service`, `get_current_principal` | `auth/test_http.py::test_bearer_header_only`; factory/session injection and real-service lifecycle in `integration/auth/test_http_lifecycle.py` |
| F30 | `A.dependencies.require_permissions`, `require_permissions.dependency` | `auth/test_adapters.py::test_permission_policy_definition`, `test_permission_truth_table`; real four-group checks and next-request HTTP grant revocation in integration suites |
| F31 | `C.request_context.request_context`, `set_audit_context` | auth HTTP IDs/no-store; `integration/auth/test_sessions.py::test_password_change_persisted_and_audited`; `test_permissions_audit.py::test_audit_context_clears_actor_and_does_not_leak`; reset SYSTEM and rollback audit assertions |
| F32–F34 | `A.delivery.build_reset_link`, `SmtpResetDelivery.available`, `SmtpResetDelivery.send`, `SmtpResetDelivery.send.deliver`, `SmtpResetDelivery._send`, `pad_reset_response` | `auth/test_adapters.py` link/padding/TLS order/cleanup/deadline/capacity/start-failure tests; `integration/auth/test_delivery.py::test_local_tls_smtp_capture` (STARTTLS/SSL plus withheld-ack timeout compensation) |
| F35–F36 | `A.rate_limit.build_rate_limit_key`, `AuthRateLimiter.check` | `auth/test_adapters.py` key/CI/thread/capacity/window/bucket tests; all seven HTTP 429s; actual direct/Nginx forwarded-header spoofing in `deployment/test_auth_smoke.py` |
| F37–F43 | `A.router.login`, `refresh_tokens`, `logout`, `get_current_user`, `change_password`, `request_password_reset`, `reset_password_with_token` | `auth/test_http.py` seven operation/status/security/schema/header comparisons, media/errors/limits; A01–A07 real-service route lifecycle and privacy in `integration/auth/test_http_lifecycle.py`; direct/proxied smoke |
| F44–F45 | `0003_auth_sessions.upgrade`, `downgrade`; SQL `dms.guard_auth_token` | `integration/auth/test_migrations.py::test_populated_upgrade_downgrade_reupgrade`, `test_token_identity_guard`, `test_revocation_irreversible_and_constraints`, `test_orm_mappings`; fresh migrations in every isolated DB |
| F46 | `app.db.seed.DemoSeed.catalog`, `app.db.seed.main` auth integration changes | `integration/auth/test_seed_compatibility.py::test_full_seed_twice_and_regression`, `test_seed_requires_new_head`; 29 tables/8 users/16 revoked tokens/410 documents, old passwords/counts and 54 baseline SQL checks |
| F47 | `AuthRepository.__init__`, `AuthService.__init__`, `SmtpResetDelivery.__init__`, `AuthRateLimiter.__init__`, `A.service.utc_now` | Injected service/settings/repository/clock instances in offline/failure/integration fixtures; adapter availability/capacity and app-local limiter tests; UTC expiries in real lifecycle |
| F48 | `AuthService.transaction`, `AuthService.require_active`, `AuthService.validate_token`, `AuthService.lock_credential`, `AuthService.issue_response`, `AuthService.authenticate_claims`, `AuthService.authenticate`; `AuthRepository.live_session` | Real lifecycle/version/locked/expired/missing/revoked/wrong-purpose cases; definite flush/sign/insert/commit rollback; defensive collaborator faults in `auth/test_failure_boundaries.py` |
| F49 | `A.schemas.CurrentUser.unique_functions` | `auth/test_primitives.py::test_permission_response_uniqueness_and_bigint`; rejects duplicate/unknown grants; source `FunctionCode` and `uniqueItems` compared in HTTP schema test |
| F50 | `A.router.responses`, `check_identity_limit` | `auth/test_http.py::test_all_auth_reachable_schema_and_header_constraints`, operation inventory and body errors; login/reset identity buckets in actual routes; limiter CI key tests |
| F51 | `app.db.base.include_name` | `integration/auth/test_migrations.py::test_orm_mappings`: actual Alembic comparison returns zero deltas, unmapped tables excluded; 100% branch coverage |
| F52 | `app.main.create_app`, `create_app.lifespan` integration changes | baseline health tests; `auth/test_http.py` docs/CORS/factory/limiter isolation; `integration/auth/test_http_lifecycle.py` real request-scoped services |

For a pure constructor/declarative mapping with no independent failure branch,
failure evidence belongs to validated Settings and its actual collaborating workflow,
not an invented constructor failure. No runtime helper is excluded from coverage.

## 9. Deployment smoke selection

`tests/deployment/test_auth_smoke.py` is both `integration` and `deployment` marked;
it is excluded from offline selection and separate from the PostgreSQL suite path.
Point `AUTH_SMOKE_DIRECT_URL` and `AUTH_SMOKE_PROXY_URL` at explicit disposable
loopback ports backed by a seeded test DB, then run:

```sh
uv run pytest tests/deployment/test_auth_smoke.py -m deployment
```

The suite checks real direct/Nginx login→me→refresh→ancestor logout, readiness/docs,
disabled-mail behavior and 121 requests with varying untrusted forwarding headers.
It exhausts buckets deliberately; use fresh one-worker test containers.
