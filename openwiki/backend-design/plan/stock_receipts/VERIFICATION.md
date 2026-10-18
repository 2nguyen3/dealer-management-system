# M15 verification

2026-10-05 planning checkpoint: source0006, five full target operations and
internal draft cancel selected from operation inventory; no implementation pass
claimed. Dedicated loopback PostgreSQL17 is separate from external Supabase.
Exact command/state/rollback/race/coverage/deployment results follow.

## Final local core gate — 2026-10-05

From backend/, explicit guarded AUTH/BUSINESS test URLs point only to disposable
PostgreSQL17 on loopback55435; create/drop per-test databases, no runtime fallback.

| Command | Result |
| --- | --- |
| `uv sync --frozen` | PASS,56 locked packages |
| `uv run ruff check .` | PASS |
| `uv run ruff format --check .` | PASS,232 Python files |
| `uv run pytest -q --tb=short` | **219 passed**,365 explicit integration/deployment deselections |
| `uv run pytest -m 'not deployment' --cov=app.modules --cov=app.common --cov=app.core --cov=app.api --cov=app.db.base --cov=tests.support --cov-branch --cov-report=term-missing --cov-report=json --cov-fail-under=100 -q --tb=short` | **564 passed**, including345 PG/TLS;20 deployment deselected; exact100% (3622 statements/622 branches) |
| `uv run pytest tests/deployment -m deployment -q --tb=short` | **20 passed**, direct58013/Nginx58093 |

Every scoped file has zero missing statements/branches; M13=418/100,
M14=97/14, M15=198/24 statements/branches, each100%. New work adds10 offline,
62 PG and2 deployment cases to the retained M01–M12 checkpoint.

### State, rollback and concurrency

Five public operations match canonical method/path/permissions/parameters/
request/response schemas/status/header definitions. Drafts are balance-neutral;
post stores final snapshots, one batch and one effect per line, then commits
validated caches/results. Forced commit failures roll back draft/header/post/
internal-cancel document, line, batch, ledger, audit and command effects.

Independent connections observe real waits: same create/post key one result;
receipts serialize stock and same-day price sources; edit/post restarts discovered
dependencies and rejects stale parents; unit/product inactivation both orders;
receipt versus READY issue retains agreed issue prices; live prepare/post grant
revocation after waits rejects writes with no audit/command effects. Revoked-session
and locked-account reads preserve401/Bearer and403 ACCOUNT_LOCKED after parent waits.

Backdated receipt on the full seed preserves all existing receivable allocations
and frozen posted prices; all7 document kinds/all24 product ledgers reconcile.
Older receipts do not replace newer purchase-price sources. Exact per-line HALF_UP,
duplicate products, integer units, zero rounded totals, combined-total overflow,
stored-current-stock overflow and >Money derived quotes have explicit tests.

### Deployment, schema and review

From root, `docker compose -f <temporary-config> --profile tools config --quiet`,
`build`, `up -d postgres --wait --wait-timeout 120`, explicit `run --rm migrate`,
`run --rm migrate alembic current` (**0006 head**), `run --rm migrate python -m app.db.seed`
(twice), `run --rm migrate python -m app.db.verify --seeded --regression` (**54 checks**),
and `up -d backend frontend --wait --wait-timeout 120` pass. Configuration lives in
the approved temporary directory and uses synthetic local credentials. Combined
tests retain fresh/populated upgrade/downgrade/re-upgrade and zero ORM drift.
No new migration or external Supabase deployment was performed.

Two independent read-only reviews found broad AuthError masking and missing direct
READY/POSTED line mutation cases. Both were reproduced/fixed; six added cases pass,
and both reviewers confirmed resolution before the full combined gate.
Core availability:58/154 target+2 health. Full receipt correction/cancellation
remain M29; shared public line/history dispatch remains M28; R3–R6 stay open.
