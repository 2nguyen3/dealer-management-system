# M03 verification

## Module-layout preservation — 2026-10-04

`app.modules.user_groups` owns routers/schemas/models/services/dependencies and
the extracted no-commit GroupRepository. The existing 21 PostgreSQL cases plus
three new caller-transaction repository cases passed in the full 108-case real
PostgreSQL/TLS run. All 159 offline and 8 deployment tests passed; each scoped
file has zero missing statements/branches. See
[refactor evidence](../../../../backend/REFACTOR_VERIFICATION.md) for exact commands,
relocations, migration/seed/regression evidence and coverage. Historical commands
below retain their original import paths.

Started 2026-10-03 after M02's 153 scoped offline/84 PG/TLS and 100% combined gate.
Schema source head is 0004. No new migration is needed for existing group tables.

**Locally verified 2026-10-03:** all five operations are published. No required
skip/xfail; M03 adds no migration. M04 users is next and must rerun the assignment
race through its own real writer before its gate closes.

| Gate | Passing evidence |
| --- | --- |
| G01/G03/G04/G09 | One offline DTO register plus real authenticated HTTP create/get/list/update/delete, strict null/extra/nonblank/PATCH policy, source IDs/statuses/security/permissions/parameter/schema/header comparisons; missing428, stale412, duplicate headers422, exact empty204. |
| G02 | Six independently specified ordering oracles, literal wildcard search, exact-code filter, signed changed-filter rejection, empty/final pages; 7000-character code/name pages use bounded signed anchor IDs; deleted anchor invalidates cursor safely. |
| G05/G06 | Both ACTIVE and LOCKED users counted and block deletion with existing grants retained; eligible grants/group deleted with two immutable audit entries; injected post-cleanup and deletion-commit failure restore group/grants/audit; creation-commit and duplicate rollback. |
| G07 | Independent real PG connections: two updates/one ETag winner; FK key-share versus group FOR UPDATE in both orders, with actual blockers observed before release. Deletion wins→assignment FK rejection; assignment wins→stale ETag, then current-token reference conflict. |
| G08 | All three read permissions individually; delete requires both; MANAGEMENT without grants denied; missing bearer401; actual HTTP update/delete waits on a group lock, committed caller grant revocation then yields403 and no target/grant/audit change. |
| P4 | 21 required PG cases plus one offline DTO case; all custom callables registered in TESTS. M03 three-file scope: 198 statements, 32 branches, zero missing. Combined auth/shared/groups/support: 33 files, 1460 statements/362 branches at100%. |
| Deployment | Built backend image plus Nginx frontend; two real direct/proxy group CRUD cases and six retained auth/shared cases: eight passed; actual runtime inventory14. |

### Commands actually run

From backend/, Python 3.12.10. Docker PostgreSQL16, loopback55432, guarded UUID-suffixed
agentra_business_test databases; source revision0004. No external Supabase writes.

```powershell
uv sync --frozen
uv run ruff check .
uv run ruff format --check .
uv run pytest
$env:BUSINESS_TEST_DATABASE_URL='postgresql+psycopg://postgres@127.0.0.1:55432/agentra_business_test'
uv run pytest tests/user_groups -m 'not integration' --cov=app.administration.groups --cov=app.api.groups --cov=app.api.schemas.groups --cov-branch --cov-report=term-missing
uv run pytest tests/integration/user_groups -m integration --cov=app.administration.groups --cov=app.api.groups --cov=app.api.schemas.groups --cov-branch --cov-append --cov-report=term-missing --cov-fail-under=100
$env:AUTH_TEST_DATABASE_URL='postgresql+psycopg://postgres@127.0.0.1:55432/agentra_auth_test'
uv run pytest tests/auth tests/shared_api tests/user_groups -m 'not integration' --cov=app.auth --cov=app.api.auth --cov=app.api.schemas.auth --cov=app.api.dependencies.auth --cov=app.api.errors --cov=app.core.request_context --cov=app.core.config --cov=app.db.base --cov=app.shared --cov=app.api.schemas.common --cov=app.api.transport --cov=app.core.transactions --cov=tests.support --cov=app.administration.groups --cov=app.api.groups --cov=app.api.schemas.groups --cov-branch --cov-report=term-missing
uv run pytest tests/integration/auth tests/integration/shared_api tests/integration/user_groups -m integration --cov=app.auth --cov=app.api.auth --cov=app.api.schemas.auth --cov=app.api.dependencies.auth --cov=app.api.errors --cov=app.core.request_context --cov=app.core.config --cov=app.db.base --cov=app.shared --cov=app.api.schemas.common --cov=app.api.transport --cov=app.core.transactions --cov=tests.support --cov=app.administration.groups --cov=app.api.groups --cov=app.api.schemas.groups --cov-branch --cov-append --cov-report=term-missing --cov-report=json --cov-fail-under=100
$env:AUTH_SMOKE_DIRECT_URL='http://127.0.0.1:18000'
$env:AUTH_SMOKE_PROXY_URL='http://127.0.0.1:18080'
uv run pytest tests/deployment -m deployment
```

Final results: frozen/static checks pass; **159 default offline** (113 integration/
deployment deselected); **154 scoped offline**; **105 PG/TLS** (58 auth+26 shared+
21 groups), **100% combined**, **8 deployed cases**. Coverage-only first groups run
had one offline/21 PG; subsequent full combined run includes the source policy and
cursor schema metadata additions. Every declared file has zero missing/excluded
statements/branches. Library deprecation notices do not alter results.

### Deployed group checkpoint

From backend/: `docker build --tag agentra-backend:groups-smoke .` passed with locked
runtime dependencies, Python3.12.15. Reused the owned isolated PostgreSQL/network
from M02 and its seeded0004 database, recreated fresh API/UI workers, then ran the
eight smoke cases. Exact service preparation from repository root:

```powershell
docker rm --force agentra-shared-api-smoke agentra-shared-ui-smoke
docker run --detach --name agentra-shared-api-smoke --network agentra-shared-api-smoke --network-alias backend --publish 127.0.0.1:18000:8000 --env DB_HOST=agentra-backend-test --env DB_NAME=agentra_auth_test --env DB_USER=postgres --env DB_PASSWORD=synthetic-disposable-only --env DB_SSLMODE=disable --env AUTH_SIGNING_KEY=synthetic-disposable-signing-key-at-least-32-bytes agentra-backend:groups-smoke
docker run --detach --name agentra-shared-ui-smoke --network agentra-shared-api-smoke --publish 127.0.0.1:18080:8080 agentra-ui:shared-api-smoke
```

These are explicitly synthetic disposable-only credentials on a local trust test
service, not provider/database deployment credentials. External Supabase migration,
SMTP/provider delivery and React group/auth screens are not verified by these tests.

### Review/failure resolutions

Standards: long TEXT cursor failure fixed with signed anchor IDs; actual-symbol
register added; sort oracles made independent. Spec: added real committed grant
revocation during update/delete lock waits, referenced-group retained grants and
deletion-commit audit rollback. All concrete findings have passing regressions.
Initial source checks also caught equivalent-but-different nullable pagination
schema metadata and missing Location uri-reference format; aligned without relaxing
behavioral constraints. Required If-Match is documented required while the shared
safe missing-header handler returns428, and raw repeated headers are still rejected.

Full backend remains open. E03 continues with M04→M05; operations are recorded in
[AVAILABILITY](../full_backend/AVAILABILITY.md), active destination in [GOAL](../full_backend/GOAL.md).

Final read-only source/evidence and deployed checks also run:

```powershell
# backend/
uv run ruff check .
uv run ruff format --check .
uv run alembic heads
uv run python "C:\Users\23521\AppData\Local\Temp\opencode\validate_dms_backend_delivery.py"
# repository root
docker compose --profile tools config --quiet
git diff --check
git diff --exit-code -- backend/alembic/sql/0001_initial.sql backend/alembic/sql/0002_search_indexes.sql
docker exec agentra-shared-api-smoke alembic current
docker exec agentra-shared-api-smoke python -m app.db.verify --seeded --regression
docker exec agentra-backend-test psql -U postgres -d agentra_auth_test -c 'SELECT version();'
```

All passed: 93 formatted Python files; source/local deployed head0004; PostgreSQL16.15;
33-file exact coverage, zero missing/excluded; 74 new callable names, 16docs/79 links,
12 source target IDs+2health; quiet Compose and whitespace; original tracked SQL
unchanged; post-smoke domain/cache/audit/report reconciliation and54baseline checks.

Owned disposable service cleanup completed after verification (repository root):

```powershell
docker rm --force --volumes agentra-shared-api-smoke agentra-shared-ui-smoke agentra-backend-test
docker network rm agentra-shared-api-smoke
```

Only these session-created containers/network were removed; local build images remain
available for later verification. Runtime source stays at0004; external data is unchanged.
