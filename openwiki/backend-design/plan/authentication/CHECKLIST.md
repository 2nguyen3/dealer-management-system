# Authentication implementation checklist

**Status: not started.** This checklist tracks future implementation, not the
creation of this plan. A checked function requires its tests to pass and an entry
in [VERIFICATION.md](VERIFICATION.md). No required skip/xfail is completion.

## P0 — Requirements and test harness

- [ ] Read PLAN, REQUIREMENTS, DESIGN, TESTS and backend guidance; confirm current head.
- [ ] Preserve source API password/response/security rules and explicit scope.
- [ ] Add locked JWT/email-validation/test dependencies; verify `uv sync --frozen`.
- [ ] Add offline settings, real-crypto fixtures, test clock, mail fake and limiter fixtures.
- [ ] Add integration marker, disposable-DB guard and local SMTP-sink setup.
- [ ] Prove missing integration configuration fails requested integration setup.
- [ ] Run existing config/health tests; register all actual new callable symbols.

## P1 — Database and mappings

- [ ] F44 upgrade/guard: new reviewed revision after head; version/session backfill and revocation.
- [ ] F45 downgrade: disposable DB revocation/drop/re-upgrade tests.
- [ ] Map five identity/access tables on shared Base, preserving SQL names (D02).
- [ ] Register ORM imports; verify no unrelated generated drops/schema changes.
- [ ] F46 seed: new-head guard and revoked-only token metadata; first/repeat seed tests.
- [ ] Update DBML/database docs for implemented delta; keep deployed snapshots unchanged.
- [ ] D01–D03 real PostgreSQL evidence passes before closing phase.

## P2 — Configuration, credentials, token primitives

- [ ] F01 settings validators/API startup validation and injected settings.
- [ ] F02 strict request schemas and safe validation behavior.
- [ ] F03 hash_password with real Argon2id tests.
- [ ] F04 verify_password with mismatch/malformed/dummy/exception tests.
- [ ] F05 cryptographic opaque-token generation.
- [ ] F06 exact-input SHA-256 digest.
- [ ] F07 JWT issuance and session-expiry clamp.
- [ ] F08 strict JWT decode and claim/signature/boundary rejection.
- [ ] F09 safe user response projection, bigint string and UTC serialization.
- [ ] S01/S03 primitive secret-leak/manipulation cases pass.

## P3 — Repository and session lifecycle

- [ ] F10 case-insensitive bound email query.
- [ ] F11 fresh user/group lookup.
- [ ] F12 digest-only owner discovery, not authorization.
- [ ] F13 fresh user locking with stale-identity-map regression.
- [ ] F14 purpose-bound token locking with user-first order.
- [ ] F15 token insertion and schema constraints.
- [ ] F16 lineage revocation, including consumed ancestor logout.
- [ ] F17 owner-wide token revocation, idempotent timestamps.
- [ ] F18 password update retrieves trigger-generated version.
- [ ] F19 current allowed function-code query.
- [ ] F20 caller-transaction reusable invalidation.
- [ ] F21 login service, locked/error/race/commit rollback cases.
- [ ] F22 refresh service, absolute expiry/rotation/replay/rollback cases.
- [ ] F23 logout service, session-local/unknown/repeated/rollback cases.
- [ ] F24 current-user service and live-session/version validation.
- [ ] C01–C03 races and D05 definite rollback tests pass on PostgreSQL.

## P4 — HTTP and reusable authorization

- [ ] F28 safe auth error/validation translation and source error headers.
- [ ] F29 real bearer/principal dependency; same request session/settings.
- [ ] F30 permission dependency and generated dependency; allOf/anyOf/both tests.
- [ ] F31 request IDs and transaction-local audit context with no pooled leakage.
- [ ] F35 limiter-key construction and reverse-proxy address policy.
- [ ] F36 bounded thread-safe limiter and precise Retry-After behavior.
- [ ] F37 login handler and A01/A08 contract cases.
- [ ] F38 refresh handler and A02/A08 contract cases.
- [ ] F39 logout handler and A03/A08 contract cases.
- [ ] F40 me handler and A04/A08 contract cases.
- [ ] P01–P03 initial grants/dynamic grants/guarded test-route scenarios pass.
- [ ] H08 health/docs/factory/CORS regression tests pass.
- [ ] Runtime OpenAPI four implemented auth operations match source subset.

## P5 — Password change and reset

- [ ] F25 self-password service; every session/reset invalidated after commit.
- [ ] F26 reset request service; identical public response, compensated mail failure.
- [ ] F27 reset completion service; single use, no unlocking/auto-login.
- [ ] F32 configured fragment reset-link composition.
- [ ] F33 account-independent delivery availability.
- [ ] F34 SMTP send and response-floor helper; TLS/timeout/header injection cases.
- [ ] F41 self-password route and A05/A08 contract cases.
- [ ] F42 reset-email route and A06/A08 contract cases.
- [ ] F43 token-reset route and A07/A08 contract cases.
- [ ] C04–C05 concurrency and D04 audit cases pass.
- [ ] S01–S03 full secret-leak/enumeration/manipulation tests pass.
- [ ] Local SMTP sink integration captures the correct recipient/link.
- [ ] Runtime OpenAPI all seven auth operations match source subset.

## P6 — Verification and release

- [ ] Every actual callable (including F47+ additions) has linked passing cases/evidence.
- [ ] Complete offline suite passes; complete required integration suite passes, no missing prerequisites.
- [ ] Auth scope reaches 100% statements/branches per file; inspect coverage JSON.
- [ ] Ruff lint/format pass; frozen install succeeds with updated lockfile.
- [ ] Fresh and populated migration, seed twice and baseline SQL verification pass.
- [ ] No passwords/tokens/signing/SMTP/database secrets in staged/tracked docs/config/logs.
- [ ] Update backend/root setup docs, AGENTS, DB docs and verification workflow for actual implementation.
- [ ] `.env.example` has blank signing/SMTP/DB passwords; settings and disabled-mail behavior documented.
- [ ] Direct and Nginx-proxied HTTP lifecycle smoke passes; proxy trust/throttling topology documented.
- [ ] One-worker/replica limiter scope explicit; shared-store work required before scaling.
- [ ] Existing health endpoints and API docs work after auth registration.
- [ ] Release acceptance items in PLAN have case IDs and recorded results.
- [ ] Record external-provider mail smoke as passed/not run with prerequisites; do not infer it from local SMTP.
- [ ] Mark module implemented only when all required completion gates pass; list genuine blockers.

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
