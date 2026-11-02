# M09 verification

2026-10-04 owning plan prepared before code; M02 prerequisite and source references
inspected. Head 0004 retained; implementation and required verification remain open.

## 2026-10-04 local completion and race repair

All five source operations and revision **0005** complete. The policy-first raw-SQL
race initially reproduced stale validation at 0004. Reviewed additive 0005 takes
unit SHARE before document/count validators and protects all recorded fraction
meaning. Both winner orders now pass for draft/count first recording and receipt
posting/inactivation. Original 0001–0004 snapshots unchanged.

[Exact shared commands/results](../users/VERIFICATION.md#2026-10-04-completion-checkpoint--m04-and-e05):
frozen sync; Ruff check/format (**143 files**); default pytest **207 passed**;
full nondeployment coverage **424 passed** (**217 PG/TLS**), exact **2173
statements/414 branches at 100%**; `uv run pytest tests/deployment -m deployment
-q --tb=short` **16 passed**. Each unit/shared file independently has zero missing
statements/branches; no required skips/xfails. [TESTS](TESTS.md) registers actual symbols.

Unused toggle, no-op, strict/default booleans, false/true filter, integer/fractional
receipt rules, inactive posting rollback, all product/draft/posted/canceled/count
references, historical-only references with productCount=0, safe duplicate/reference
errors, post-lock revocation, stale writers and all mutation rollback points pass.
Direct SQL recorded-policy violation reports the named check and leaves state intact.
Fresh head, populated 0004→0005, downgrade→re-upgrade, full seed twice, all historical
snapshots and **54** baseline regressions pass. ORM metadata has no drift.

Explicit CLI `uv run alembic upgrade head`/`uv run alembic current` → 0005,
`uv run python -m app.db.seed` twice, and `uv run python -m app.db.verify --seeded --regression`
also passed on separate disposable PostgreSQL. Final-image direct/Nginx CRUD passed
at 58004/58084. Supabase deployment is operational and was not performed.
