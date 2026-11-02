# Verification

2026-10-04: plan prepared before code. Implementation and verification pending.
Existing disposable PostgreSQL container is available on loopback port 55434;
test URLs are not inherited in this session and must be configured explicitly.
No gates closed on the basis of prior modules' tests.

Owned integration checkpoint: `uv run pytest tests/integration/permissions -m
integration --cov=app.modules.permissions --cov-branch --cov-report=term-missing
--cov-fail-under=100 -q --tb=short`: **4 passed**, 133 statements/12 branches,
exact 100%. Tests prove persisted grants/audit, rollback, two creators and two
mutating updates with one winner, owner deletion and next-request revocation.
Final exact runtime contract and combined regressions remain required.

## Final local completion — 2026-10-04

Final command from backend/:
`uv run pytest -m 'not deployment' --cov=app.modules --cov=app.common --cov=app.core --cov=app.api --cov=app.db.base --cov=tests.support --cov-branch --cov-report=term-missing --cov-report=json --cov-fail-under=100 -q --tb=short`
passed **492 cases** (209 offline +283 PostgreSQL/TLS), 18 deployment cases
deliberately deselected, no skips/xfails. Combined scope: **2903 statements /484
branches, exact 100%**; every file has zero missing statements/partial branches.
M05 owns **133 statements /12 branches**, individually 100%.

Final `uv run ruff check .` and `uv run ruff format --check .` pass (199 files).
`uv sync --frozen` audited 56 locked packages. `uv run pytest -q --tb=short`:
**209 passed**, integration/deployment deliberately deselected.
`uv run pytest tests/deployment -m deployment -q --tb=short`: **18 passed** on
fresh disposable direct port 58005 /Nginx port 58085, including M05 grants/audit.
Head0006 fresh/populated upgrade/downgrade/re-upgrade, seed twice and 54 SQL
checks pass; see [packet evidence](../full_backend/VERIFICATION.md#2026-10-04-m05m06m10m12-completion).

Exact source/runtime checks cover all five method/path/operation/schema/parameter/
response/header/policy branches, including PUT 200 and 201 schemas. Real tests
prove absent→true→false, same-token next-request denial, every route's false/missing
grant and anonymous denial, post-lock revocation, two creators/updates, both group
deletion orders with atomic cleanup and rollback/audit correlation. No required
M05 gate remains open. External Supabase remains an explicit deployment input.
