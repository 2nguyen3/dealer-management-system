# Verification

2026-10-04: plan prepared before code. D16 recommendation selected; canonical
schema update and persisted witnesses remain required. No completion claim.

## Final local completion — 2026-10-04

From backend/, `uv run pytest -m 'not deployment' --cov=app.modules --cov=app.common --cov=app.core --cov=app.api --cov=app.db.base --cov=tests.support --cov-branch --cov-report=term-missing --cov-report=json --cov-fail-under=100 -q --tb=short`:
**492 passed** (209 offline +283 PostgreSQL/TLS), no skips/xfails; 18 deployment
cases deliberately deselected. Combined **2903 statements /484 branches**, exact
100% per file. M10 owns **82 statements /4 branches**, individually 100%.
`uv sync --frozen` (56 packages), `uv run ruff check .`,
`uv run ruff format --check .` (199 files) and `uv run pytest -q --tb=short`
(**209 passed**) pass. `uv run pytest tests/deployment -m deployment -q --tb=short`:
**18 passed**, including current rules GET/PATCH at direct58005 /Nginx58085.

Both source operations exactly match schemas/parameters/statuses/headers/security.
Empty/null/extra/float inputs and rate/cap boundaries, exact maximum usage,
blocked-district details, stale preconditions, rollback/audit and post-lock grant
revocation pass. Independent same-ETag writers have one winner; lower-cap/admission
race passes both orders; rate/source posting produces the current exact quote.
D16 canonical Product/InventoryChange quote refs are widened before publication;
real receipt price6e17 × rate2 returns1200000000000000000, and price1 × .000001
returns0. Stored snapshots are unchanged. `common.prices.stored_selling_price`
rejects unusable issue quotes with409 SELLING_PRICE_UNUSABLE, preserving Money.
M07/M08 dependency regressions pass. No required M10 gate remains open; future
issue writers must consume this stored-price seam. See [packet](../full_backend/VERIFICATION.md#2026-10-04-m05m06m10m12-completion).
