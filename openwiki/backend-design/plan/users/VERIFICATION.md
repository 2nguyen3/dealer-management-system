# M04 verification

2026-10-04 planning checkpoint: M03 prerequisite evidence inspected; existing
uncommitted baseline retained. Source head 0004. No implementation gates closed.
Exact execution results and actual-symbol test-node mapping will be recorded here.

## 2026-10-04 completion checkpoint — M04 and E05

M04/M07/M08/M09 owning six-file plans existed before code. All 20 operations now
pass their full local gates. Source/deployed disposable head: **0005**. Existing
uncommitted M01–M03 work retained; external Supabase was not migrated by this task.

### Exact commands and results (working directory backend/)

Integration URLs explicitly identified disposable loopback PostgreSQL 17 on port
55434, with separate `agentra_auth_test`/`agentra_business_test` prefixes and guarded
per-test create/drop databases. No runtime DB fallback. Credentials omitted here.

| Command | Result |
| --- | --- |
| `uv sync --frozen` | PASS, 56 locked packages audited |
| `uv run ruff check .` | PASS |
| `uv run ruff format --check .` | PASS, 143 Python files |
| `uv run pytest -q` | **207 passed**, 233 integration/deployment cases deliberately deselected |
| `uv run pytest -m 'not deployment' --cov=app.modules --cov=app.common --cov=app.core --cov=app.api --cov=app.db.base --cov=tests.support --cov-branch --cov-report=term-missing --cov-report=json --cov-fail-under=100 -q --tb=short` | **424 passed**, 16 deployment cases deselected; includes **217 real PostgreSQL/TLS** cases; no skips/xfails |
| `uv run pytest tests/deployment -m deployment -q --tb=short` | **16 passed**, direct `http://127.0.0.1:58004` and Nginx `http://127.0.0.1:58084` |
| `uv run alembic upgrade head` / `uv run alembic current` | PASS / **0005 (head)** on separate `agentra_business_test_verify` DB |
| `uv run python -m app.db.seed` (twice) | PASS, first atomic commit, second verification/no changes; 410 documents, 30 agencies, 24 products |
| `uv run python -m app.db.verify --seeded --regression` | PASS, 30 physical tables and **54** baseline assertions/rejections |

Coverage is exact per-file, zero missing statements, zero missing/partial branches:
**2173 statements / 414 branches, 100.00%** across all listed scope. Every new owned
and shared file independently reports 100%. Actual-symbol/node register: [TESTS](TESTS.md).

### State, races and review

M04 mixed-case email one-winner, M04 create/update vs M03 deletion (both orders),
group/status/reset vs login/refresh (12 independent orders), stale ETag writers,
joined-group rename/profile/reset serialization and real unchanged/stale target
grant revocation all pass. Independent reads prove hash/version/status/group and
refresh/reset/audit rollback after invalidation and commit failures. Profile/no-op
changes retain sessions; actual changes revoke both token purposes. Locked reset
retains LOCKED, produces no session/password response. Safe validation/audit and
all five source schemas/status/header/permission inventories pass.

Standards review identified balance-lock reauthorization and mutable cursor anchors;
spec review identified authorization-before-ETag and joined-label serialization.
All substantive findings fixed with passing real regression nodes. The source
blocker shape remains agencyId/agencyCode/currentDebt, reflected in child design.

Docker Desktop restarted after the user's stop. Disposable verification images
rebuilt from the final source; PostgreSQL/backend/Nginx healthy at deployment test.
Temporary Compose config outside repo contains synthetic settings only; its
`docker compose -f <temporary-config> --profile tools config --quiet`, `build`,
explicit migration/seed and `up -d --wait --wait-timeout 120` passed.
Full goal remains active: next **M05 permissions**, then M06; M10 is also eligible.

Final documentation checks from repository root passed:
`python openwiki/backend-design/plan/full_backend/validate_plan.py` validates
154 operations, 40 backend/39 frontend dependency edges, 42 owning/program documents,
284 local links across 52 documents and 3050 OpenAPI references.
`docker compose --profile tools config --quiet` and `git diff --check` passed.
The validator was aligned with the module-layout refactor, both proposed/actual
M02 registers and head0005; immutable tracked 0001/0002 SQL has no diff.
