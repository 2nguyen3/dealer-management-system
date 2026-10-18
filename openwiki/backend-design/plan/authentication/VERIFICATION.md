# Authentication plan and implementation verification

## Module-layout preservation — 2026-10-04

Relocated auth to `app.modules.auth`, passwords to `app.core.security`, shared
errors to `app.core.exceptions`/`app.common.responses`, and user/group mappings to
their owning modules. The combined regression run passed 159 offline tests,
108 real PostgreSQL/TLS tests and 8 direct/Nginx smoke cases, with zero missing
statements/branches in the declared scope. See the exact commands and relocation
map in [refactor evidence](../../../../backend/REFACTOR_VERIFICATION.md).
Commands below retain their historical locations; current commands are in TESTS
and the [verification workflow](../../../../.agents/workflows/verify.md).

## 1. Plan preparation status

Prepared 2026-10-01 from the BA, database README/decisions/DBML/psql entry points,
versioned identity/audit/RBAC DDL, backend API contract, current backend settings/
factory/session/migration/seed/test infrastructure and repository verification rules.

The plan covers all seven source Authentication operation IDs and includes
function-level tests, real database migration/rollback checks, multi-session races,
SMTP delivery behavior, checklist gates and source traceability.

**Historical planning task:** no executable authentication was added during the
2026-10-01 planning session. The implementation and passing evidence below were
added on 2026-10-02; the historical documentation checks are not runtime evidence.

Documentation validation was run from the repository root using Python 3.12.10.

## 2. Documentation validation evidence

| Check | Result |
| --- | --- |
| Source JSON parsing / seven auth operation inventory | Passed: all seven operation IDs/methods/paths covered; 33 function codes and nonempty-password contract confirmed. |
| Local Markdown links / intended new plan files | Passed: six plan documents and 22 local Markdown links resolve, including the General Plan link; no trailing whitespace. |
| F01–F46 checklist and test-register consistency | Passed: 46 register entries have unchecked checklist items; A01–A08 and C01–C05 scenarios present. |
| `git diff --check` | Passed, exit 0; Git emitted repository line-ending conversion notices. |
| Agent-guidance links and plan/test-gate instructions | Passed: root/backend AGENTS reference plan, TESTS and VERIFICATION; runtime auth still explicitly unimplemented. |
| General Plan integration | Passed: M01 is authentication; 32 ordered slices and 40 acyclic dependency edges match the roadmap graph; all 28 API tags covered; 13 roadmap links and both AGENTS roadmap references resolve. |

Exact validation commands (working directory: repository root):

```powershell
python --version
python "C:\Users\23521\AppData\Local\Temp\opencode\validate_dms_auth_plan.py"
git diff --check
```

The temporary read-only validator is a session artifact outside the repository,
not a new backend test or release dependency. It checks plan links/registries
against the source JSON. Backend pytest, live SQL, SMTP, coverage and Docker
checks were not run for this documentation-only task.

## 3. Implementation evidence log

**Implemented and locally verified, 2026-10-02.** Diff baseline: `dd29752`;
uncommitted working-tree authentication implementation. Production symbols are
registered under F01–F52 in TESTS §8. No commit or Supabase mutation was performed.

| Date | Function IDs / symbols | Case IDs / test nodes | Exact command / directory | Result / revision | Blockers |
| --- | --- | --- | --- | --- | --- |
| 2026-10-02 | F01–F09, F28–F36, F47–F50; crypto/schemas/config/errors/dependencies/SMTP/limiter | Offline files `test_primitives`, `test_http`, `test_adapters`, `test_failure_boundaries`, `test_harness` | Commands A–C below, `backend/` | 122 offline tests (117 auth + 5 baseline); passing lint/format/frozen install; no skips/xfails | Provider configuration is operational, not needed offline. |
| 2026-10-02 | F10–F27, F31, F44–F48, F51; repository/transactions/migration/seed/audit | Real-state `test_sessions`, `test_migrations`, `test_seed_compatibility`, `test_permissions_audit` | Command D below, `backend/` | 58 required integration cases overall; preserved/rolled-back token/password/audit state; no skips/xfails | Disposable PostgreSQL only; external Supabase upgrade remains explicit. |
| 2026-10-02 | C01–C05; user-first locks and refreshed identity maps | 13 parameterized cases in `test_concurrency.py` | Command D below | Real independent connections/events; refresh/reset one-winner, refresh/logout both orders, login/refresh after password/group/status change, reset/change both orders and concurrent reset issuance | None for local concurrency gates. |
| 2026-10-02 | F32–F34; real delivery | Four STARTTLS/SSL success/withheld-ack cases in `test_delivery.py` | Command D below | Generated trusted local certificates, real encrypted mail capture; total caller deadline and persisted revocation on unknown delivery | External SMTP provider not configured/exercised. |
| 2026-10-02 | F37–F43, A01–A08, H08, P01–P03 | Real-service HTTP lifecycle/privacy, source-schema comparisons, four-group permission checks | Commands B–D below | Seven operation IDs/status/security inventories and all reachable source schema/header constraints pass; safe 204/401/403/429/500/503 and current grants | Frontend reset/login UI is outside module. |
| 2026-10-02 | F35/F36 plus deployment wiring | Four direct/proxied lifecycle and varying-forwarded-header cases | Command E below | Actual built backend and Nginx frontend on disposable Docker network; 4 passed; liveness/readiness/docs and no-store verified | One worker; Nginx clients share its peer bucket. |

Never put raw password/token/signing/SMTP/database credentials or reset links in
this log. Reference fixture names and secret-safe test output instead.

## 4. Phase evidence summary

| Phase | Required evidence | Status |
| --- | --- | --- |
| P0 | Harness, markers, disposable-DB guard, locked install, baseline tests | Passed; explicit missing-URL selection fails setup instead of skipping. |
| P1 | Fresh/populated upgrade, downgrade/re-upgrade, mappings, repeat seed | Passed; no metadata diff; immutable snapshots preserved. |
| P2 | Real cryptographic helpers, settings, safe schemas | Passed, including fractional-expiry and secret-safe failures. |
| P3 | Session lifecycle, rollback, C01–C03 | Passed on PostgreSQL. |
| P4 | HTTP contracts, permission decisions, request context, limiter | Passed; four-group grants, immediate revocation and context isolation. |
| P5 | Password/reset, C04–C05, local SMTP capture, audit/privacy | Passed; replay/expiry/same-password/locked/reset and unknown-delivery compensation. |
| P6 | Full suites, per-file coverage, docs, deployment smoke | Passed locally; operational limits below. |

## 5. Release environment and unverified behavior

Environment:

- Offline/integration runner: Python 3.12.10 on Windows, uv 0.10.8, pytest 9.1.1.
- Disposable Docker PostgreSQL **16.15**, container `agentra-auth-test`, loopback 55432.
  Harness creates/drops UUID-suffixed `agentra_auth_test_*` databases; it does not
  borrow runtime `DB_*` or the Supabase demo. Test-only PostgreSQL uses trust on the
  isolated local network; test credentials are supplied outside this evidence log.
- Alembic head **0003**; fresh 0001→0002→0003 and populated 0002→0003 tested.
  Business/catalogue rows, account hashes and existing revocation timestamps
  survive upgrade; downgrade/re-upgrade and repeated upgrade pass.
- Runtime lock additions: PyJWT 2.15.1, email-validator 2.3.0. Dev additions:
  pytest-cov 7.1.0, jsonschema 4.26.0, aiosmtpd 1.4.6, cryptography 48.0.1.
- Combined coverage JSON: **16 files, 721 statements, 154 branches; zero missing
  statements/branches and zero excluded lines in every file**. Scope includes all
  auth behavior plus complete `core.config` and `db.base`; existing main/router
  integration points have dedicated tests rather than whole-backend coverage claims.
- Default suite: **122 passed, 62 deliberately deselected** (58 PostgreSQL/TLS +
  4 explicit deployment cases). Scoped offline auth selection: **117 passed**.
  Required integration selection: **58 passed**. Deployment: **4 passed**.
  Required cases have no skips or xfails. Library deprecation notices are warnings.
- Local SMTP sink uses generated certificates and tests verified STARTTLS/implicit
  TLS. Deadline tests hold the DATA acknowledgement with an event until timeout;
  no guessed millisecond sleeps determine ordering.
- Deployment smoke: built Python 3.12.15 backend (initial image 3.12.14) and Nginx frontend; one API process,
  direct `127.0.0.1:18000`, proxy `127.0.0.1:18080`, `--no-proxy-headers`.
  121 varying forwarding-header requests remain in the same peer bucket and end in
  429 on both paths. Nginx users share its bucket until restricted proxy trust is configured.

### Exact final commands (A–F)

Working directory `backend/` unless noted. Set the URL only to the disposable
test service; the harness additionally guards the database name/runtime DB_NAME.

```powershell
# A — frozen install and static checks
uv sync --frozen
uv run ruff check .
uv run ruff format --check .

# B — all offline tests, including existing health/config regressions
uv run pytest -m "not integration"

# C — start scoped coverage with real crypto/HTTP/adapter behavior
uv run pytest tests/auth -m "not integration" --cov=app.auth --cov=app.api.auth --cov=app.api.schemas.auth --cov=app.api.dependencies.auth --cov=app.api.errors --cov=app.core.request_context --cov=app.core.config --cov=app.db.base --cov-branch --cov-report=term-missing

# D — required real-state/race/TLS/seed cases and strict combined coverage
$env:AUTH_TEST_DATABASE_URL='postgresql+psycopg://postgres@127.0.0.1:55432/agentra_auth_test'
uv run pytest tests/integration/auth -m integration --cov=app.auth --cov=app.api.auth --cov=app.api.schemas.auth --cov=app.api.dependencies.auth --cov=app.api.errors --cov=app.core.request_context --cov=app.core.config --cov=app.db.base --cov-branch --cov-append --cov-report=term-missing --cov-report=json --cov-fail-under=100

# E — independently deployed direct/Nginx smoke, fresh one-worker test containers
$env:AUTH_SMOKE_DIRECT_URL='http://127.0.0.1:18000'
$env:AUTH_SMOKE_PROXY_URL='http://127.0.0.1:18080'
uv run pytest tests/deployment/test_auth_smoke.py -m deployment
```

Result: A all passed (51 formatted Python files), B 122 passed, C 117 passed,
D 58 passed with exact 100% gate, E 4 passed. D also executes the real fresh seed
twice, unchanged 29-table counts/old demo passwords, 410 documents/16 revoked tokens
and all **54** baseline SQL assertions/rejections in a rolled-back separate schema.

F, repository root:

```powershell
docker compose --profile tools config --quiet
git diff --check
```

Compose quiet validation passed without exposing resolved settings. Documentation,
actual-symbol links and JSON coverage are also checked by the temporary read-only
validator recorded below; it is not a backend runtime dependency.

Read-only validator (working directory `backend/`):

```powershell
uv run python "C:\Users\23521\AppData\Local\Temp\opencode\validate_dms_auth_evidence.py"
```

Passed: exact per-file JSON coverage (16 files/721 statements/154 branches), all 77
callable definitions across 18 scoped files named in the actual-symbol register,
77 local links across 14 docs, and no diff in deployed 0001/0002 SQL snapshots.
One unchanged preexisting root tooling link was excluded from auth link validation.

### Docker execution evidence

Executed builds from owning directories:

```powershell
# backend/
docker build --tag agentra-auth-backend:smoke .
# ui/
docker build --tag agentra-auth-frontend:smoke .
```

Disposable service preparation (repository root):

```powershell
docker run --detach --name agentra-auth-test --publish 127.0.0.1:55432:5432 --env POSTGRES_DB=agentra_auth_test --env POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine
docker network create agentra-auth-smoke
docker network connect agentra-auth-smoke agentra-auth-test
$env:AUTH_SIGNING_KEY=[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:DB_PASSWORD=[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
docker run --rm --network agentra-auth-smoke --env DB_HOST=agentra-auth-test --env DB_NAME=agentra_auth_test --env DB_USER=postgres --env DB_PASSWORD --env DB_SSLMODE=disable agentra-auth-backend:smoke alembic upgrade head
docker run --rm --network agentra-auth-smoke --env DB_HOST=agentra-auth-test --env DB_NAME=agentra_auth_test --env DB_USER=postgres --env DB_PASSWORD --env DB_SSLMODE=disable agentra-auth-backend:smoke python -m app.db.seed
docker run --rm --network agentra-auth-smoke --env DB_HOST=agentra-auth-test --env DB_NAME=agentra_auth_test --env DB_USER=postgres --env DB_PASSWORD --env DB_SSLMODE=disable agentra-auth-backend:smoke python -m app.db.verify --seeded --regression
docker run --detach --name agentra-auth-api-smoke --network agentra-auth-smoke --network-alias backend --publish 127.0.0.1:18000:8000 --env DB_HOST=agentra-auth-test --env DB_NAME=agentra_auth_test --env DB_USER=postgres --env DB_PASSWORD --env DB_SSLMODE=disable --env AUTH_SIGNING_KEY agentra-auth-backend:smoke
docker run --detach --name agentra-auth-ui-smoke --network agentra-auth-smoke --publish 127.0.0.1:18080:8080 agentra-auth-frontend:smoke
docker exec agentra-auth-test psql -U postgres -d agentra_auth_test -c 'SELECT version();'
docker exec agentra-auth-api-smoke alembic current
```

All above passed: built locked images; full seed committed; verifier 29 tables/
54 regressions; PostgreSQL 16.15 and `0003 (head)` confirmed. No raw signing/database
credential value is recorded. Rerun verification after initial auth smoke found 24
token history rows (16 seed + 8 smoke records); existing seed/business data were unchanged.

### Failure/review history and resolutions

- The negative harness command below produced the intended setup error (1 error,
  no skip/fallback); the complete configured run subsequently passed:
  `$env:AUTH_TEST_DATABASE_URL=$null; uv run pytest tests/integration/auth/test_sessions.py::test_login_rotation_logout -m integration`.
- Early contract tests expected field validation before missing bearer authentication;
  the validation-only test supplies a principal, while real header rejection and
  actual service lifecycle remain independently covered.
- Standards and spec reviews found final-fractional-second JWT issuance, total SMTP
  deadline, weak runtime schema metadata, missing group/audit scenarios and typed
  collaborator gaps. These were fixed and passing cases added; helper/query
  duplication was reviewed as a nonblocking judgement call.
- Initial very short SMTP delay fixtures were unreliable with coverage/thread/TLS
  overhead. Replaced guessed sleeps with held-ack events and normal 5/6-second bounds;
  the full 58-case coverage run now passes.
- Docker Desktop restarted during a smoke rerun; Windows then reserved the original
  58000/58080 ports. Owned smoke containers were recreated on 18000/18080, and all
  4 deployment cases passed. No unrelated containers were modified.

#### Standards review

Three hard findings resolved: final fractional-second JWT issuance, missing initial
group/audit-isolation scenarios and untyped collaborator interfaces. The duplicated
ordered-revocation query shape was considered a nonblocking judgement call; the two
public repository operations retain distinct session-wide/user-wide responsibilities.

#### Specification review

Three findings resolved: whole-SMTP-operation deadline (instead of per-socket-only),
fractional JWT expiry rollback and source-compatible required/enum/unique/schema
metadata. The source/runtime comparison now traverses requests, responses and headers.

Review summary: Standards 3 hard + 1 judgement finding, worst concrete issue invalid
near-expiry JWT; Spec 3 findings, worst issue unbounded total mail timing. All hard
findings have passing regression evidence; no blocking review finding remains.

### Operational limits / not run

- Supabase revision 0003 deployment was **not run** against the external demo;
  explicit upgrade and real backend signing key are deployment inputs.
- External provider SMTP smoke was **not run**: no provider credentials/sender
  configuration was supplied. Local TLS transport tests are not provider evidence.
- Frontend login/reset screens, durable mail queue, shared multi-worker throttling
  and trusted-proxy per-client buckets are outside M01's declared implementation.
- Padding/total delivery deadline is tested; arbitrary-load timing indistinguishability
  is not claimed. Database contention and scheduling can exceed the response floor.

Disposable service cleanup after final smoke (repository root):

```powershell
docker rm --force --volumes agentra-auth-api-smoke agentra-auth-ui-smoke agentra-auth-test
docker network rm agentra-auth-smoke
```

Only verification services/network created in this task are removed. Local images
can be reused for future disposable verification. The external demo remains unchanged.

## Retained M02/M03 regression, 2026-10-03

Shared errors/context/contract support now serve business routes too; the prior
auth behavior remains covered. Current combined scope adds shared/group cases:
159 default offline, 105 PG/TLS, exact33-file100% (1460 statements/362 branches),
eight direct/Nginx cases including all four auth smoke cases. Exact current commands:
[M03 VERIFICATION](../user_groups/VERIFICATION.md). Source head0004; external
Supabase/mail deployment remains separate. Historical M01-only evidence above is preserved.
