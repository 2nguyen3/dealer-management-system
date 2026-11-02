# M14 verification

2026-10-05 plan prepared against source0006 and canonical OpenAPI. No M14
implementation result claimed. Uses explicit guarded disposable BUSINESS test URL
on loopback55435, never runtime DB_* fallback. Exact command results follow.

## Final local gate — 2026-10-05

Owning query/append/reversal tests passed: `uv run pytest tests/integration/documents/test_inventory.py -m integration --cov=app.modules.inventory --cov-branch --cov-report=term-missing --cov-fail-under=100 -q --tb=short` → **4 passed, exact100% (97 statements/14 branches)**.
Canonical runtime contract and all24 seeded product ledgers also passed.

Retained combined command:
`uv run pytest -m 'not deployment' --cov=app.modules --cov=app.common --cov=app.core --cov=app.api --cov=app.db.base --cov=tests.support --cov-branch --cov-report=term-missing --cov-report=json --cov-fail-under=100 -q --tb=short`
→ **564 passed (219 offline +345 PG/TLS), 20 deployment intentionally deselected**,
zero required skips/xfails; exact100% across3622 statements/622 branches, every
file zero missing statements/partial branches. Inventory retains97/14 at100%.

`uv run pytest tests/deployment -m deployment -q --tb=short` → **20 passed** on
direct58013/Nginx58093. Ruff check/format pass (232 Python files), frozen sync
passes. Disposable PostgreSQL17 head0006, seed twice and54 SQL checks pass; retained
fresh/populated migration and metadata drift tests pass in the combined suite.
No DDL change or external Supabase migration. D14's historical1.2e15 quantity
witness is preserved in canonical AggregateQuantity; one SQL snapshot calculates
complete event balances before source/effective/page filters.
