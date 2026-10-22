# Backend module-layout refactor verification

**Date:** 2026-10-04. **Result:** all required refactor checks passed.

## Scope and ownership

Refactored the existing working-tree backend into feature-owned modules while
preserving the application factory, synchronous request sessions, HTTP contracts,
transaction/authorization semantics and reviewed Alembic SQL. Existing local work
was carried forward. There are still 14 published operations: two health, seven
authentication and five user-group operations. Users administration and products
APIs remain future work; the users package owns the existing employee ORM mapping.

| Previous location | Current location |
| --- | --- |
| `app/auth/` services/repository/tokens/delivery/limiter/registry | `app/modules/auth/` |
| `app/api/auth.py`, `schemas/auth.py`, `dependencies/auth.py` | `app/modules/auth/router.py`, `schemas.py`, `dependencies.py` |
| `app/administration/groups.py` | `app/modules/user_groups/service.py` and `repository.py` |
| `app/api/groups.py`, `schemas/groups.py` | `app/modules/user_groups/router.py`, `schemas.py`, `dependencies.py` |
| `app/auth/models.py::AppUser` | `app/modules/users/models.py::AppUser` |
| `app/auth/models.py::UserGroup` | `app/modules/user_groups/models.py::UserGroup` |
| `app/auth/models.py::AuthToken/AppFunction/GroupPermission` | `app/modules/auth/models.py` |
| `app/auth/models.py::Timestamps` | `app/db/base.py::Timestamps` |
| `app/auth/passwords.py` | `app/core/security.py` |
| `app/api/errors.py` exception types | `app/core/exceptions.py` |
| `app/api/errors.py` HTTP handlers; shared error-schema constant | `app/common/responses.py` |
| `app/shared/`, `app/api/schemas/common.py`, `app/api/transport.py` | `app/common/`, `schemas.py`, `transport.py` |
| Health handlers previously in `app/api/router.py` | `app/modules/health/router.py` |

`app/api/router.py` now aggregates all feature routers and is mounted once by
`create_app`. Each ORM table has one mapping and shares the same Base; Alembic
imports all mapped owners. GroupRepository contains persistence but never commits
or rolls back; GroupService retains its existing transaction boundary. Application
logger namespaces live in `app/core/logging.py`; Uvicorn retains handler/level
configuration. Call sites still log fixed labels without credentials/exception text.

`backend/alembic/` remains the single migration authority, and root `compose.yaml`
remains the deployment composition. Startup, settings, dependencies/lockfiles,
database connection fields and the seed/verifier CLI paths were not changed by
this refactor. Tests and current plans/guidance use the new imports; older evidence
logs retain the commands that actually ran at their historical checkpoints.

## Results

Environment: Windows, Python 3.12.10, frozen uv environment, Docker PostgreSQL
16-alpine on disposable loopback port 55432. No production/demo Supabase database
was used for refactor testing. The integration harness creates and drops guarded
UUID-suffixed databases and generates local SMTP TLS certificates.

| Verification | Actual result |
| --- | --- |
| Pre-refactor `uv run pytest` | 159 passed, 113 integration/deployment cases deselected |
| `uv sync --frozen` | Passed; 56 packages audited |
| `uv run ruff check .` | Passed |
| `uv run ruff format --check .` | Passed; 101 Python files formatted |
| Post-refactor offline suite | 159 passed, 116 integration/deployment cases deselected |
| Real PostgreSQL/TLS suite | 108 passed, no skipped/xfailed cases |
| Combined strict scoped coverage | 1533 statements and 362 branches; zero missing statements/branches in every reported file; 100% |
| `uv run coverage report --fail-under=100` | Passed; same per-file 100% results |
| Backend Docker image build | Passed with locked runtime install and non-root runtime |
| Container Alembic upgrade/current | Passed; `0004 (head)` |
| Container demo seed, twice | Passed; rerun verified existing data with unchanged counts |
| Container seeded database verification | Passed; 30 tables including infrastructure, timestamps, document/ledger/cache/audit/report integrity |
| Container SQL regression | All 54 baseline assertions/rejections passed in an isolated rolled-back schema |
| Direct API + Nginx deployment suite | 8 passed; real runtime inventory remains 14 operations |
| Quiet Compose validation | Passed |
| `git diff --check` | Passed; no whitespace errors |
| Reviewed 0001/0002 SQL snapshot diff | Empty; deployed snapshots unchanged |

PostgreSQL suites include fresh/populated upgrade and downgrade/re-upgrade, no-delta
ORM metadata comparison, actual independent-connection token/group/command races,
persisted state, audit/credential safety and transaction rollback. The extracted
repository additionally has three real-state create/update/delete cases in
`tests/integration/user_groups/test_groups.py::test_repository_mutations_remain_in_caller_transaction`.
An independent connection sees only committed state; caller rollback restores
group/grants and leaves no tentative rows/audit.

Coverage scope is `app.modules`, `app.common`, `app.core`, `app.api`, `app.db.base`
and `tests.support`. This is a strict refactor/module coverage result, not a claim
of 100% coverage for every database CLI or future backend operation.

## Commands actually run

From `backend/`:

```powershell
uv run pytest
uv sync --frozen
uv run ruff check .
uv run ruff format --check .
uv run pytest --cov=app.modules --cov=app.common --cov=app.core --cov=app.api --cov=app.db.base --cov=tests.support --cov-branch --cov-report=term-missing
$env:AUTH_TEST_DATABASE_URL='postgresql+psycopg://postgres@127.0.0.1:55432/agentra_auth_test'
$env:BUSINESS_TEST_DATABASE_URL='postgresql+psycopg://postgres@127.0.0.1:55432/agentra_business_test'
uv run pytest tests/integration/auth tests/integration/shared_api tests/integration/user_groups -m integration --cov=app.modules --cov=app.common --cov=app.core --cov=app.api --cov=app.db.base --cov=tests.support --cov-branch --cov-append --cov-report=term-missing --cov-report=json --cov-fail-under=100
uv run coverage report --fail-under=100
docker build --tag agentra-backend:refactor .
$env:AUTH_SMOKE_DIRECT_URL='http://127.0.0.1:18000'
$env:AUTH_SMOKE_PROXY_URL='http://127.0.0.1:18080'
uv run pytest tests/deployment -m deployment
```

Disposable deployment preparation from the repository root (the password below
is a synthetic local test value; the PostgreSQL container uses isolated trust auth):

```powershell
docker run --detach --name agentra-refactor-test --publish 127.0.0.1:55432:5432 --env POSTGRES_DB=agentra_auth_test --env POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine
docker exec agentra-refactor-test pg_isready -U postgres
docker network create agentra-refactor-smoke
docker network connect agentra-refactor-smoke agentra-refactor-test
docker run --rm --network agentra-refactor-smoke --env DB_HOST=agentra-refactor-test --env DB_NAME=agentra_auth_test --env DB_USER=postgres --env DB_PASSWORD=refactor-test-password --env DB_SSLMODE=disable agentra-backend:refactor alembic upgrade head
docker run --rm --network agentra-refactor-smoke --env DB_HOST=agentra-refactor-test --env DB_NAME=agentra_auth_test --env DB_USER=postgres --env DB_PASSWORD=refactor-test-password --env DB_SSLMODE=disable agentra-backend:refactor python -m app.db.seed
docker run --rm --network agentra-refactor-smoke --env DB_HOST=agentra-refactor-test --env DB_NAME=agentra_auth_test --env DB_USER=postgres --env DB_PASSWORD=refactor-test-password --env DB_SSLMODE=disable agentra-backend:refactor python -m app.db.seed
docker run --rm --network agentra-refactor-smoke --env DB_HOST=agentra-refactor-test --env DB_NAME=agentra_auth_test --env DB_USER=postgres --env DB_PASSWORD=refactor-test-password --env DB_SSLMODE=disable agentra-backend:refactor python -m app.db.verify --seeded --regression
$env:AUTH_SIGNING_KEY=[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
docker run --detach --name agentra-refactor-api --network agentra-refactor-smoke --network-alias backend --publish 127.0.0.1:18000:8000 --env DB_HOST=agentra-refactor-test --env DB_NAME=agentra_auth_test --env DB_USER=postgres --env DB_PASSWORD=refactor-test-password --env DB_SSLMODE=disable --env AUTH_SIGNING_KEY agentra-backend:refactor
docker run --detach --name agentra-refactor-ui --network agentra-refactor-smoke --publish 127.0.0.1:18080:8080 agentra-ui:shared-api-smoke
docker exec agentra-refactor-api alembic current
docker compose --profile tools config --quiet
git diff --check
git diff --exit-code -- backend/alembic/sql/0001_initial.sql backend/alembic/sql/0002_search_indexes.sql
docker rm --force agentra-refactor-ui agentra-refactor-api agentra-refactor-test
docker network rm agentra-refactor-smoke
```

The existing `agentra-ui:shared-api-smoke` image supplies Nginx for the proxy tests;
the backend image was rebuilt from the refactored source. Synthetic key material
is not printed or recorded. Provider SMTP delivery and production deployment were
not exercised. Existing third-party FastAPI/Starlette/AnyIO/Alembic deprecation
warnings remain; they caused no test failures.

The three disposable test containers and their network were removed after verification.
