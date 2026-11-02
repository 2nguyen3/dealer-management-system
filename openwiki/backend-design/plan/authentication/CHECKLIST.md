# Authentication implementation checklist

**Status: implemented; local verification gates passed (2026-10-02).**
A checked function requires its tests to pass and an entry
in [VERIFICATION.md](VERIFICATION.md). No required skip/xfail is completion.

- [x] 2026-10-04 module-layout preservation: actual-symbol paths/coverage commands
  aligned; offline/PostgreSQL/TLS/deployment regressions and scoped 100% coverage
  passed. See [refactor evidence](../../../../backend/REFACTOR_VERIFICATION.md).

## P0 — Requirements and test harness

- [x] Read PLAN, REQUIREMENTS, DESIGN, TESTS and backend guidance; confirm current head.
- [x] Preserve source API password/response/security rules and explicit scope.
- [x] Add locked JWT/email-validation/test dependencies; verify `uv sync --frozen`.
- [x] Add offline settings, real-crypto fixtures, test clock, mail fake and limiter fixtures.
- [x] Add integration marker, disposable-DB guard and local SMTP-sink setup.
- [x] Prove missing integration configuration fails requested integration setup.
- [x] Run existing config/health tests; register all actual new callable symbols.

## P1 — Database and mappings

- [x] F44 upgrade/guard: new reviewed revision after head; version/session backfill and revocation.
- [x] F45 downgrade: disposable DB revocation/drop/re-upgrade tests.
- [x] Map five identity/access tables on shared Base, preserving SQL names (D02).
- [x] Register ORM imports; verify no unrelated generated drops/schema changes.
- [x] F46 seed: new-head guard and revoked-only token metadata; first/repeat seed tests.
- [x] Update DBML/database docs for implemented delta; keep deployed snapshots unchanged.
- [x] D01–D03 real PostgreSQL evidence passes before closing phase.

## P2 — Configuration, credentials, token primitives

- [x] F01 settings validators/API startup validation and injected settings.
- [x] F02 strict request schemas and safe validation behavior.
- [x] F03 hash_password with real Argon2id tests.
- [x] F04 verify_password with mismatch/malformed/dummy/exception tests.
- [x] F05 cryptographic opaque-token generation.
- [x] F06 exact-input SHA-256 digest.
- [x] F07 JWT issuance and session-expiry clamp, including final fractional-second rejection.
- [x] F08 strict JWT decode and claim/signature/boundary rejection.
- [x] F09 safe user response projection, bigint string and UTC serialization.
- [x] S01/S03 primitive secret-leak/manipulation cases pass.

## P3 — Repository and session lifecycle

- [x] F10 case-insensitive bound email query.
- [x] F11 fresh user/group lookup.
- [x] F12 digest-only owner discovery, not authorization.
- [x] F13 fresh user locking with stale-identity-map regression.
- [x] F14 purpose-bound token locking with user-first order.
- [x] F15 token insertion and schema constraints.
- [x] F16 lineage revocation, including consumed ancestor logout.
- [x] F17 owner-wide token revocation, idempotent timestamps.
- [x] F18 password update retrieves trigger-generated version.
- [x] F19 current allowed function-code query.
- [x] F20 caller-transaction reusable invalidation.
- [x] F21 login service, locked/error/race/commit rollback cases.
- [x] F22 refresh service, absolute expiry/rotation/replay/rollback cases.
- [x] F23 logout service, session-local/unknown/repeated/rollback cases.
- [x] F24 current-user service and live-session/version validation.
- [x] C01–C03 races and D05 definite rollback tests pass on PostgreSQL.

## P4 — HTTP and reusable authorization

- [x] F28 safe auth error/validation translation and source error headers.
- [x] F29 real bearer/principal dependency; same request session/settings.
- [x] F30 permission dependency and generated dependency; allOf/anyOf/both tests.
- [x] F31 request IDs and transaction-local audit context with no pooled leakage.
- [x] F35 limiter-key construction and reverse-proxy address policy.
- [x] F36 bounded thread-safe limiter and precise Retry-After behavior.
- [x] F37 login handler and A01/A08 contract cases.
- [x] F38 refresh handler and A02/A08 contract cases.
- [x] F39 logout handler and A03/A08 contract cases.
- [x] F40 me handler and A04/A08 contract cases.
- [x] P01–P03 initial grants/dynamic grants/guarded test-route scenarios pass.
- [x] H08 health/docs/factory/CORS regression tests pass.
- [x] Runtime OpenAPI four implemented auth operations match source subset.

## P5 — Password change and reset

- [x] F25 self-password service; every session/reset invalidated after commit.
- [x] F26 reset request service; identical public response, compensated mail failure.
- [x] F27 reset completion service; single use, no unlocking/auto-login.
- [x] F32 configured fragment reset-link composition.
- [x] F33 account-independent delivery availability.
- [x] F34 SMTP send and response-floor helper; TLS/total-deadline/header injection cases.
- [x] F41 self-password route and A05/A08 contract cases.
- [x] F42 reset-email route and A06/A08 contract cases.
- [x] F43 token-reset route and A07/A08 contract cases.
- [x] C04–C05 concurrency and D04 audit cases pass.
- [x] S01–S03 full secret-leak/enumeration/manipulation tests pass.
- [x] Local SMTP sink integration captures the correct recipient/link.
- [x] Runtime OpenAPI all seven auth operations and reachable schemas match source subset.

## P6 — Verification and release

- [x] Every actual callable (F01–F52) has linked passing cases/evidence in TESTS §8.
- [x] Complete offline suite passes; complete required integration suite passes, no missing prerequisites.
- [x] Auth scope reaches 100% statements/branches per file; inspect coverage JSON.
- [x] Ruff lint/format pass; frozen install succeeds with updated lockfile.
- [x] Fresh and populated migration, seed twice and baseline SQL verification pass.
- [x] Secret-safe code/errors/logging reviewed; committed templates contain no signing/SMTP/DB credentials.
- [x] Update backend/root setup docs, AGENTS, DB docs and verification workflow for actual implementation.
- [x] `.env.example` has blank signing/SMTP/DB passwords; settings and disabled-mail behavior documented.
- [x] Direct and Nginx-proxied HTTP lifecycle/forwarded-header smoke passes; topology documented.
- [x] One-worker/replica limiter scope explicit; shared-store work required before scaling.
- [x] Existing health endpoints and API docs work after auth registration.
- [x] Release acceptance items in PLAN have case IDs and recorded results.
- [x] External-provider mail smoke recorded as not run; requires real provider configuration.
- [x] Local module gates passed; external Supabase deployment and provider mail are operational follow-ups.

## Function evidence mini-template

Copy one entry per completed function (or tightly linked group with each symbol named):

```text
Function ID and actual symbol:
Source requirement IDs:
Implementation files / revision or diff identifier:
Test file::test_node_ids and scenario IDs:
Exact command and working directory:
Result (passed/failed, counts, no required skips):
State/rollback/concurrency assertions, if applicable:
Coverage / uncovered branches:
Recorded date and remaining blockers:
```
