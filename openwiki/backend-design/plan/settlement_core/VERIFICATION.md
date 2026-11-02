# M16 verification

## 2026-10-17 M17–M20 consumer regression

All25retained PostgreSQL settlement cases pass using isolated Supabase schemas,
including full-demo financial replay with all existing evidence/frozen revisions
preserved. The pure selection now passes30cases; two new cases independently check
maximum valid current debt/credit and one-over409/BALANCE_OVERFLOW, introduced while
integrating the actual M17/M18 writers. Actual callable remains `replay._timeline`
through public `plan_replay`; no new runtime helper was introduced.

Combined M16 pure/PG coverage is477statements/208branches exact100% in every file.
The affected M16–M20/shared scope totals33files/1285statements/306branches exact100%.
See [program commands/results](../full_backend/VERIFICATION.md) for the705-case resumed
non-deployment selection and22direct/Nginx cases; older617-case coverage below is
historical. M23 return-line rounding, M27 providers and M29 corrections remain separate.

## Baseline — 2026-10-11

Inspected current working tree, preserved existing user work. Source head0006;
M16 module/owning plan absent before this task. `uv run pytest -q --tb=short`
from backend/: **219 passed,365 deselected**. Existing6 deprecation warnings.

Docker Desktop started; dedicated `agentra-settlement-pg` PostgreSQL17 uses
loopback55435 and synthetic local credentials only. Guarded disposable test URLs
will use agentra_auth_test/agentra_business_test; no runtime DB_* fallback.
## Final local M16 gate — 2026-10-11

From backend/, AUTH_TEST_DATABASE_URL and BUSINESS_TEST_DATABASE_URL explicitly
identify disposable loopback55435 test databases with connect_timeout5. No runtime
database fallback or external Supabase write. All database cases create/drop fresh
databases using the existing guarded factory and reviewed head0006.

| Command actually run | Result |
| --- | --- |
| `uv sync --frozen` | PASS,56 locked packages |
| `uv run ruff check .` | PASS |
| `uv run ruff format --check .` | PASS,252 Python files |
| `uv run alembic heads` | PASS,0006 head |
| `uv run pytest tests/settlement_core -q --tb=short` |28 pure cases pass in final combined run; last standalone run26 passed before adding the final two multi-return cases |
| `uv run pytest tests/settlement_core tests/integration/settlement_core -m 'not deployment' --cov=app.modules.settlement_core --cov-branch --cov-report=term-missing --cov-report=json --cov-fail-under=100 -q --tb=short` |51 passed/exact100% before the final two pure multi-return regressions;465 statements/198 branches at that checkpoint |
| `uv run pytest -m 'not deployment' --cov=app.modules --cov=app.common --cov=app.core --cov=app.api --cov=app.db.base --cov=tests.support --cov-branch --cov-report=term-missing --cov-report=json --cov-fail-under=100 -q --tb=short` | **617 passed**,20 deployment deselected,494.26s;247 offline +370 PG/TLS; no skip/xfail |

Final combined coverage is exact100% in every file: **4096 statements/830 branches**,
zero missing. M16 runtime alone: **474/208, exact100%**. Adds **28 offline +25 PG**
cases to M15's564 non-deployment cases. Existing deprecation warnings remain.
The combined run retains fresh/populated upgrade/downgrade/re-upgrade, metadata,
repeat seed and SQL54 regression cases. No new schema revision or HTTP route.

### Persisted state, rollback and real concurrency

- Manual FIFO partial/full invoices; future invoices excluded; excess and zero
  invalid posting fail. Automatic charge+receipt shares the exact issue checkpoint.
- Confirmed separate cash records full money, FIFO and excess; actual ONLINE
  success fixtures retain full late cash and credit origin.
- Backdated issue changes later allocation; a further earlier receipt replays it
  again without editing original ledger rows or frozen revisions.
- A valid earlier receipt before existing credit application/return/paid refund
  reverses only affected financial legs, preserves precise paid refund sources,
  and produces original cash provenance92+10 on the return.
- Entire seed financial replay preserves every frozen revision and online payment,
  upfront confirmation, refund attempt and reservation row; caches reconcile.
- Two independent receipts compete for debt; two reservations compete for credit;
  reserve-versus-credit application tested in both winner orders. Harness observes
  actual PostgreSQL lock waits, not mocked scheduling.
- Actual AuthService grant revocation during an observed agency/balance wait denies
  posting after the wait. Independent agency type change between discovery/reread
  returns40001 and succeeds after caller rollback/restart.
- Mutation after one appended leg and commit injection roll back source/revision,
  batches, financial entries and audit. Reservation release rollback retains ACTIVE;
  terminal consumption is single-use. Real UNKNOWN attempt cannot release money.
- Current debt limit and invalidation of ACTIVE credit fail with full caller rollback.

### Review closure and interrupted run

Independent standards/spec reviews reproduced unstable new-lot FIFO, greedy
duplicate-lot protection, cross-origin return selection and earlier-return use of
later protected provenance. All were fixed with measured pure regressions; duplicate
lot reserved/paid fixes also have real PG cases. Both review axes confirmed original
findings resolved; final spec follow-up passed8 pure review cases with no findings.
One targeted rerun timed out while the dedicated Docker PG container was stopped
(exit255, no OOM); restarted the same isolated container and reran with bounded
connect_timeout. Interrupted run is not passing evidence. Final combined gate passed.

### Handoff

M16 E09/E10 internal gate passed. Next M17 stock_issues owning plan/E11. Published
API remains58/154 +2 health; financial capability register does not publish future
domain writers. Return-line rounding/new revisions remain M23; paid/provider refund
workflow M27; full correction/cancellation M29; R3–R6 open.
Direct/Nginx20-case deployment evidence remains the M15 checkpoint and was not rerun
in this task. No external Supabase migration/deployment or provider call.

### Final documentation/configuration checks

From root: `python openwiki/backend-design/plan/full_backend/validate_plan.py`
passes154 operations/28 API areas/33 permissions,40 backend and39 frontend acyclic
edges,96 package documents/420 local links across106 documents,3050 OpenAPI refs.
`git diff --check` passes (existing LF/CRLF conversion notices only).
`docker compose --profile tools config --quiet` passes without printing secrets.
`git diff --exit-code -- backend/alembic/sql/0001_initial.sql backend/alembic/sql/0002_search_indexes.sql`
passes; deployed snapshots unchanged. README/guidance/general/child/full-backend
and frontend operation-specific readiness trackers now reference M17 as next
backend slice without closing any frontend gate.
