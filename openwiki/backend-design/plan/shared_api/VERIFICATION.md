# M02 verification log

## HTTP framework headers preserved - 2026-10-29

M29/M30 publication exposed the business HTTPException projection dropping405Allow.
`http_error_handler` now passes framework headers to ApiError while retaining the
generic safe body. New `test_method_not_allowed_preserves_framework_allow_header`
and `test_required_precondition_header_validation_is_428` cover real HTTP/error/schema/
request-ID and mandatory precondition failure/success. Existing400/privacy/auth tests
remain passing. No constructor/helper was added; SA03 actual-symbol register updated.
Final full offline1083pass200.43s; responses.py48statements18branches exact100% with
zero missing/excluded/partial branches. Source API66/0 and reports438/98 exact separately.
Deployed old-wrong-method expectation updated404to405; all11unique endpoint cases
pass across direct/proxy/public resumes. [Full evidence](../reports/VERIFICATION.md).

## Module-layout preservation — 2026-10-04

Shared primitives and HTTP transport now live in `app.common`; exception types
live in `app.core.exceptions`. Existing shared behavior passed the combined
159 offline / 108 PostgreSQL/TLS / 8 deployment run, with 100% statements/branches
in every scoped file. Migration/seed/54-regression compatibility also passed.
See [refactor evidence](../../../../backend/REFACTOR_VERIFICATION.md) for current
commands. Older commands below preserve their historical locations.

## Planning

Prepared 2026-10-02 during the [whole-backend deep dive](../full_backend/PLAN.md).
Read current auth/shared entry points, source HTTP components, SQL constraints,
seed/verifier and isolated auth test harness. Requirements R01–R14 map to proposed
SA01–SA18 responsibilities and I01–I08 integrated scenarios.

Documentation validation is recorded in
[full backend VERIFICATION](../full_backend/VERIFICATION.md); it is planning evidence
only. Shared_api had no implementation during that planning session.
The 2026-10-02 deep-review refinement added D16's derived-price overflow/rounded-zero
boundary to R01/SA01 and the numeric design. The shared register and documentation
passed the full-backend validator; no M02 implementation/phase gate was closed.

## Implementation evidence

**Implemented and locally verified 2026-10-03.** E01/E02 and P0–P5 complete.
Current source head 0004. Prior dirty authentication/design work was preserved;
no commit or external Supabase mutation was performed. Runtime publishes only
the nine health/auth operations at this checkpoint. M02 owns no business route.

| Gate | Evidence | Result |
| --- | --- | --- |
| P0/SA18 | Frozen baseline, shared guarded factory/schema resolver/source transport matrix | Baseline 122 offline pass; all 154 target operations represented; explicit missing business URL gives setup error, no skip/runtime fallback. |
| P1/SA01–SA05 | Exact domains/native response hydration/date/offset/Vietnam boundary/errors/business audit | 36 shared offline tests and PG actor/SYSTEM/rollback probes; strict numeric strings, integer catalog body versus path, no SQL/input secrets. |
| P2/SA06–SA09 | Typed signed scoped cursors, tie-safe keysets, literal search, aggregate ETags and single-header preconditions | Both SQL sort directions and ties; child-only edits and one-winner stale update; duplicate header rejection; 428/412/current ETag. |
| P3/SA10–SA14 | Durable scoped commands, safe JSON-normalized result, substeps, caller transaction and projection-after-deferred-refresh | 26 shared PG cases: same-key one effect, payload conflict, cross-actor/operation/resource scope, composed keys, four rollback points, lost committed reply, restart references, actual SERIALIZABLE/deadlock retries and exhausted budget. |
| P4/SA15–SA17 | Modeled/bodyless/raw transport, limiter interface, CORS, explicit manifests | Populated 0003→0004 preserves hashes/history; fresh seed twice; zero command rows valid; unexpected tables/timestamps rejected; all 54 baseline 0001 checks pass. |
| P5 | Combined auth/shared scoped coverage, deployment, review and documentation | 153 scoped offline + 84 PG/TLS pass; 30 files/1259 statements/328 branches at exact 100%; 6 built direct/Nginx smoke tests pass. No required skips/xfails. |

### Actual integrated scenarios

- I01: `test_etag_lock_one_winner_and_stale_replay` and child-only aggregate change.
- I02: `test_concurrent_matching_and_changed_payload`; real HTTP command inserts one
  district and exactly one request-correlated business audit event.
- I03: `test_actor_scope_and_composed_substeps` plus operation/resource scopes.
- I04: `test_failure_rolls_back_command_domain_and_audit` (mid-write, deferred FK,
  invalid projection, definite commit failure), then same key succeeds once.
- I05: `test_lost_commit_reply_recovers_with_same_key` plus stale HTTP replay.
- I06: real auth/current-grant denial in `test_http_commands`; locked replay denied.
- I07: shared HTTP probes and duplicate/header/media/bodyless/direct/proxy checks.
- I08: populated upgrade, unchanged hashes/documents, repeat seed, safe empty
  downgrade/re-upgrade; downgrade with durable identities rejects without data loss.

### Exact commands and environment

Working directory backend/ unless noted. Python 3.12.10; disposable Docker PostgreSQL
16 on loopback 55432; UUID-suffixed databases created/dropped by the harness. Auth and
business use separate guarded base names. API image Python 3.12.15; single worker,
no forwarded-header trust. RFC3339 checker is locked as a dev dependency.

```powershell
uv sync --frozen
uv run ruff check .
uv run ruff format --check .
uv run pytest
uv run pytest tests/shared_api
$env:AUTH_TEST_DATABASE_URL='postgresql+psycopg://postgres@127.0.0.1:55432/agentra_auth_test'
$env:BUSINESS_TEST_DATABASE_URL='postgresql+psycopg://postgres@127.0.0.1:55432/agentra_business_test'
uv run pytest tests/integration/auth -m integration
uv run pytest tests/integration/shared_api -m integration
uv run pytest tests/auth tests/shared_api -m 'not integration' --cov=app.auth --cov=app.api.auth --cov=app.api.schemas.auth --cov=app.api.dependencies.auth --cov=app.api.errors --cov=app.core.request_context --cov=app.core.config --cov=app.db.base --cov=app.shared --cov=app.api.schemas.common --cov=app.api.transport --cov=app.core.transactions --cov=tests.support --cov-branch --cov-report=term-missing
uv run pytest tests/integration/auth tests/integration/shared_api -m integration --cov=app.auth --cov=app.api.auth --cov=app.api.schemas.auth --cov=app.api.dependencies.auth --cov=app.api.errors --cov=app.core.request_context --cov=app.core.config --cov=app.db.base --cov=app.shared --cov=app.api.schemas.common --cov=app.api.transport --cov=app.core.transactions --cov=tests.support --cov-branch --cov-append --cov-report=term-missing --cov-report=json --cov-fail-under=100
$env:AUTH_SMOKE_DIRECT_URL='http://127.0.0.1:18000'
$env:AUTH_SMOKE_PROXY_URL='http://127.0.0.1:18080'
uv run pytest tests/deployment -m deployment
```

Final scoped selections: 153 offline (117 auth + 36 shared) and 84 PG/TLS
(58 auth + 26 shared). Successful intermediate runs had fewer shared cases as
tests were added. The default suite also includes five preexisting config/health
tests. Coverage JSON is a generated local artifact: every declared file has zero
missing/excluded statements/branches. Migration/seed/verifier have separate real
state/CLI evidence; the scoped percentage is not whole-backend coverage.

Negative harness command (expected **one setup error**, no skip/fallback):

```powershell
$env:BUSINESS_TEST_DATABASE_URL=$null
uv run pytest tests/integration/shared_api/test_commands.py::test_command_replay_scope_conflict_and_revocation -m integration
```

Deployment preparation actually run:

```powershell
# backend/ and ui/, respectively
docker build --tag agentra-backend:shared-api-smoke .
docker build --tag agentra-ui:shared-api-smoke .
# repository root; generated environment secrets are never printed
docker run --detach --name agentra-backend-test --publish 127.0.0.1:55432:5432 --env POSTGRES_DB=agentra_auth_test --env POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine
docker network create agentra-shared-api-smoke
docker network connect agentra-shared-api-smoke agentra-backend-test
$env:AUTH_SIGNING_KEY=[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:DB_PASSWORD=[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
docker run --rm --network agentra-shared-api-smoke --env DB_HOST=agentra-backend-test --env DB_NAME=agentra_auth_test --env DB_USER=postgres --env DB_PASSWORD --env DB_SSLMODE=disable agentra-backend:shared-api-smoke alembic upgrade head
docker run --rm --network agentra-shared-api-smoke --env DB_HOST=agentra-backend-test --env DB_NAME=agentra_auth_test --env DB_USER=postgres --env DB_PASSWORD --env DB_SSLMODE=disable agentra-backend:shared-api-smoke python -m app.db.seed
docker run --rm --network agentra-shared-api-smoke --env DB_HOST=agentra-backend-test --env DB_NAME=agentra_auth_test --env DB_USER=postgres --env DB_PASSWORD --env DB_SSLMODE=disable agentra-backend:shared-api-smoke python -m app.db.verify --seeded --regression
docker run --detach --name agentra-shared-api-smoke --network agentra-shared-api-smoke --network-alias backend --publish 127.0.0.1:18000:8000 --env DB_HOST=agentra-backend-test --env DB_NAME=agentra_auth_test --env DB_USER=postgres --env DB_PASSWORD --env DB_SSLMODE=disable --env AUTH_SIGNING_KEY agentra-backend:shared-api-smoke
docker run --detach --name agentra-shared-ui-smoke --network agentra-shared-api-smoke --publish 127.0.0.1:18080:8080 agentra-ui:shared-api-smoke
```

Built verifier passed: **30 tables, 60 required timestamps, 410 documents, zero
command rows**, domain/cache/audit/report integrity and **54 baseline checks**.
Smoke: four retained lifecycle/spoof cases plus two shared header/error/inventory cases.

### Review findings and resolutions

Standards review: one hard checker-availability issue, two correctness findings
(native command-result normalization before commit and invalid timezone offsets),
one duplication judgement. Spec review: missing cross-actor/composed acceptance and
checker enforcement; incorrect catalog path/native Decimal response hydration,
repeated-header handling and timezone offsets. All concrete findings were fixed
with passing cases; auth delegates contract validation to shared support. A modeled
body cannot bypass signature-before-parsing through raw metadata.

Other early failures fixed before the final run: path-level source parameters,
test namespace collisions, JSON null versus SQL NULL, timestamp routine name,
ORM table comment and JSON literal binds in a test. An initial PowerShell chained
assignment failed parsing without side effects; preparation was rerun correctly.

## Entry conditions and later dependencies

- Reconfirm M01 checks using its existing evidence/commands in a disposable setup.
- Source head is now 0004; external Supabase deployment was not run. Use explicit
  migration before running this application/seed against that environment.
- Extend current auth privacy/error/context behavior without lowering its coverage.
- Provider operational choice, dashboard permission decision and chatbot candidate
  pagination are later full-backend gates; M02 exposes the needed seams.
- Full-backend E03–E22 remain open at this checkpoint. The active destination is
  recorded in [GOAL](../full_backend/GOAL.md); M02 completion is not full completion.

## M03 integration regression

The later group integration preserves the gates: 159 default offline, 154 scoped
offline, 105 PG/TLS, exact33-file100% (1460 statements/362 branches), eight deployed
direct/proxy cases. [M03 evidence](../user_groups/VERIFICATION.md) records exact commands.
Business missing required If-Match now has safe428 with required runtime metadata;
Pagination's nullable schema and cursor parameter metadata match the source.
M03 resolves long unbounded sort text with a signed ID anchor, retaining M02's
bounded generic codec. Earlier M02 numbers remain its historical checkpoint.
