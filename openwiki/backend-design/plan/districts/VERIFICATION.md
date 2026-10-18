# M07 verification

2026-10-04: owning plan prepared before code, M02 prerequisite inspected. Existing
source head 0004; no deployment change or completion claimed at planning checkpoint.

## 2026-10-04 local completion

All five source operations complete at head **0005**. Exact shared command/output
record is [M04 checkpoint](../users/VERIFICATION.md#2026-10-04-completion-checkpoint--m04-and-e05):
`uv sync --frozen`; `uv run ruff check .`; `uv run ruff format --check .`;
`uv run pytest -q` (**207 passed**); full nondeployment coverage command (**424
passed**, including **217 PG/TLS**, exact **2173 statements/414 branches, 100%**);
`uv run pytest tests/deployment -m deployment -q --tb=short` (**16 passed**).
No required skip/xfail. Each district/shared file has zero missing statements/branches.

M07 tests prove global capacity, empty/full (four slots)/fifth admission rollback,
active vs terminated counts, current global rule changing the ETag, inactivation
preserving existing agencies, all-reference deletion, both admission/inactivation
and reference/deletion winning orders, stale competing writers and post-wait grant
revocation. Every mutation's commit/constraint/projection failure restores row/audit.
Original seed transactions/snapshots survive rename/reference guards. Exact nodes
and inherited symbols are registered in [TESTS](TESTS.md).

`uv run alembic upgrade head`, `uv run alembic current` → 0005;
`uv run python -m app.db.seed` twice and `uv run python -m app.db.verify --seeded --regression`
passed on a separate disposable DB (410 documents, 54 regression assertions).
Final-image direct/Nginx five-operation CRUD smoke passed on 58004/58084.
M07 has no deferred operation; M10/M12 consumers remain separately planned.
