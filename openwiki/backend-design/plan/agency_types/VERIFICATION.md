# M08 verification

2026-10-04 planning: M02 prerequisite/source DDL inspected, owning child prepared
before code. Head 0004 retained. Required implementation/verification gates open.

## 2026-10-04 local completion

All five operations complete, disposable head **0005**. [Exact combined commands](../users/VERIFICATION.md#2026-10-04-completion-checkpoint--m04-and-e05)
record frozen sync, Ruff lint/format (**143 files**), default pytest (**207 passed**),
full `-m 'not deployment'` coverage (**424 passed** including **217 PG/TLS**,
**2173 statements/414 branches, exact 100%**) and `uv run pytest tests/deployment
-m deployment -q --tb=short` (**16 passed**). Each agency-type/shared file independently
has no missing statements/branches. No required skips/xfails.

Persisted 0/exact maxDebt, all/active counts, debt equality (102 VND), one-over
rejection (101), terminated debt blocker and unchanged 1000-VND historical snapshot
pass. Real issue-post/limit, type-assignment/limit and reference/deletion both-order
races pass, as do ETags and rollback. Permission revocation during the later balance
lock wait denies before blocker projection/mutation; target-wait stale/unchanged
revocation is separately proved. Source-shaped blockingAgencies and runtime schemas/
status/headers/anyOf reads validated. Domain and named uniques match inspected PG
metadata with **zero autogenerate differences**.

Exact symbol/node register: [TESTS](TESTS.md). Explicit isolated CLI migration/current
0005, twice seed and `uv run python -m app.db.verify --seeded --regression` pass
(410 documents/54 regression assertions). Final-image direct/Nginx CRUD passed at
58004/58084. M08 closed; M10/M12 are separate subsequent consumer gates.
