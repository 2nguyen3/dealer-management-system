# M13 verification

2026-10-05 planning checkpoint: inspected current working tree, source0006,
OpenAPI and SQL triggers. No M13 passing result claimed at plan preparation.
`uv sync --frozen` passed (56 locked packages). Docker Desktop started; a dedicated
loopback PostgreSQL17 container `agentra-m13-m15-pg` was created on55435 with
synthetic credentials, separate from Supabase. Exact implementation results follow.

## Internal slice checkpoint — 2026-10-05

From backend/, with explicit guarded BUSINESS_TEST_DATABASE_URL on loopback55435:

`uv run pytest tests/document_core tests/integration/documents/test_core.py tests/integration/documents/test_core_races.py -m 'not deployment' --cov=app.modules.document_core --cov-branch --cov-report=term-missing --cov-fail-under=100 -q --tb=short`

**24 passed (8 offline +16 PG), no skips/xfails, exact100%** across413 statements/
94 branches. All410 demo documents/411 revisions/7 kinds project against canonical
schemas, including cancelled/superseded history and refund attempts/reservations.
Neutral drafts, same-total ETags, per-line rounding, deferred parent links,
rollback, append-only batches and observed independent-connection blocking pass.
Provisional issue price rejects missing source/rounded-zero quotes via D16.
Combined prerequisite/quality/deployment verification follows M14/M15 integration.

## Final integrated gate — 2026-10-05

The [M15 exact-command log](../stock_receipts/VERIFICATION.md) supersedes the
internal checkpoint's scope: **564 combined (219 offline+345 PG/TLS),20 direct/Nginx**,
exact100% across3622 statements/622 branches; M13 independently418 statements/
100 branches. Source/disposable head0006, frozen sync, Ruff (232 files), seed twice,
54 SQL checks and retained fresh/populated migration/metadata cases pass.

Both read-only reviews confirmed fixed auth-error propagation and explicit READY/
POSTED create/replace/delete rejection. Actual register additions:
`test_values.py::test_any_of_reads_preserve_authentication_errors`,
`test_read_session_races.py::test_blocked_receipt_read_preserves_session_and_account_errors`,
`test_core.py::test_all_line_mutations_reject_frozen_revisions_without_persisted_effects`.
The existing all7-kind seed test now also checks every product statement and a
real backdated M15 posting without changing frozen prices/cash allocations.
M13 internal slice closes; M28 public operations remain deferred.
