# Verification

2026-10-04: prepared before code. All required verification gates remain open.

## Final local completion — 2026-10-04

From backend/, `uv run pytest -m 'not deployment' --cov=app.modules --cov=app.common --cov=app.core --cov=app.api --cov=app.db.base --cov=tests.support --cov-branch --cov-report=term-missing --cov-report=json --cov-fail-under=100 -q --tb=short`:
**492 passed** (209 offline +283 PostgreSQL/TLS), no skips/xfails; 18 deployment
cases deliberately deselected. Combined **2903 statements /484 branches**, exact
100% per file. M12 owns **218 statements /24 branches**, individually 100%.
`uv sync --frozen` (56 packages), `uv run ruff check .`,
`uv run ruff format --check .` (199 files), `uv run pytest -q --tb=short`
(**209 passed**) pass. `uv run pytest tests/deployment -m deployment -q --tb=short`:
**18 passed**, including create/terminate/replay/delete at direct58005 /Nginx58085.

Six exact source operations, all false/missing/anonymous policies and post-lock
authorization pass. Generated identity, duplicate contacts, zero caches, master
state/cap/type-debt guards, nullable contact edits, all filters including contact
q, accepted-date/history, rollback and audit correlation pass.
Independent last-slot admission, both cap-lowering orders, opposing moves, type
limit lowering vs agency move, termination vs posting, both reference/delete orders,
same-key termination/replay and replay revocation during command-claim wait pass.
0006 coordinates revision-date writes with acceptance edits; both date-race orders
preserve history. Termination retains nonzero debt, permanently denies reopen,
replays original committed result, rejects conflicting keys and rolls back failed
command/audit/state together. Shared D02 direct-cache/eligible-delete/migration/
seed54 gates and M07/M08/M10 regressions pass. No required M12 gate remains open.
See [packet](../full_backend/VERIFICATION.md#2026-10-04-m05m06m10m12-completion).
