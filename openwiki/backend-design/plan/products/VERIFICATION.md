# Verification

2026-10-04: prepared before code. No required gate closed without executed tests.

## Final local completion — 2026-10-04

From backend/, `uv run pytest -m 'not deployment' --cov=app.modules --cov=app.common --cov=app.core --cov=app.api --cov=app.db.base --cov=tests.support --cov-branch --cov-report=term-missing --cov-report=json --cov-fail-under=100 -q --tb=short`:
**492 passed** (209 offline +283 PostgreSQL/TLS), no skips/xfails; 18 deployment
cases deliberately deselected. Combined **2903 statements /484 branches**, exact
100% per file. M11 owns **151 statements /12 branches**, individually 100%; shared
SqlCatalogueRepository and stored-price seam are also individually 100%.
Frozen sync (56 packages), `uv run ruff check .`, `uv run ruff format --check .`
(199 files), `uv run pytest -q --tb=short` (**209 passed**) pass.
`uv run pytest tests/deployment -m deployment -q --tb=short`: **18 passed**,
including eligible zero-cache delete at direct58005 /Nginx58085.

All five source operations match full schema/status/header/filter/policy inventory.
Duplicate names, generated monotonic codes, ACTIVE-unit checks, missing/inactive
units, threshold equality/ranges, exact source provenance, mutable numeric keyset
anchors, client balance/price/code rejection, state/rollback/audit pass.
Independent first-use vs unit change/delete, both master inactivation/assignment
orders and real post-lock revocation pass. Draft/count/posted/canceled historical
references block deletion and unit changes even after net stock returns to zero.

D02: reproduced both owner failures at0005; reviewed0006 cascade succeeds, rollback
retains owner/cache and direct cache DELETE/UPDATE stays denied. Fresh/populated
upgrade/downgrade/re-upgrade and repeat seed/54 SQL checks pass. Legacy non-posted
unit-reference fixtures are created at0005 and retained after upgrade;0006 now
rejects new recorded product moves. D16 large/rounded-zero quotes remain readable
and source cancellation clears provenance without erasing history. M09/M10 gates
pass in the same scope. No required M11 gate remains open. See [packet](../full_backend/VERIFICATION.md#2026-10-04-m05m06m10m12-completion).
