# M23 verification

## 2026-10-18 — return core and reviewed0007 verified

Five complete operations and internal draft cancellation are delivered; posted
correction/full cancellation remain M29 and public shared lines/history remain M28.
**21 owning cases**:11 offline (contracts/independent rounding)+10 real PG, all passing
in the final node union. Actual symbols and exact nodes are in [TESTS](TESTS.md).

**Exact owning Python scope:**7 `app/modules/sales_returns/` files plus
`alembic/versions/0007_return_lot_successors.py`:250statements/50branches,100% per file.
Module-only scope is240/50; new migration is10/0. Changed shared production is also
included in the final30-file/1162-statement/162-branch exact100% gate, with zero
missing/excluded statements or missing/partial branches. SQL guard semantics are
verified by real persisted-state/migration tests, not claimed as Python SQL-string coverage.

### Actual final commands/checkpoints

From backend/, worker explicitly supplies SUPABASE_TEST_SCHEMAS=1:

```powershell
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-m23-guards2 tests/integration/sales_returns/test_guards.py tests/integration/sales_returns/test_races.py -m integration -vv --tb=short --maxfail=1 -o faulthandler_timeout=180 --cov=app.modules.sales_returns --cov-branch --cov-report=term-missing --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-m23-guards2-coverage.json
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-final-m23-http tests/integration/sales_returns/test_http.py tests/integration/sales_returns/test_returns.py::test_backdated_return_replaces_frozen_rounding_without_mutation tests/integration/sales_returns/test_protected_rounding.py::test_protected_rounding_reproduction[paid] -m integration -vv --tb=short --maxfail=1 -o faulthandler_timeout=180 --cov=app.modules.sales_returns --cov-branch --cov-report=term-missing --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-final-m23-http-coverage.json
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-migration-coverage tests/integration/sales_returns/test_migration.py -m integration -vv --tb=short -o faulthandler_timeout=180 --cov=alembic/versions --cov-branch --cov-report=term-missing --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-migration-coverage.json
```

These pass2+3+1PG cases. Additional completed checkpoints:
`agentra-return-current-head` (original debt/stock case under0007),
`agentra-m23-protected-fix` (reserved and paid source cases),
`agentra-final-unchanged-return` (no unnecessary successor), and
`agentra-credit-history-fixed` (credit-funded return plus M24 reversal read).
Duplicate nodes are counted once. The migration worker's raw `.coverage` is retained;
its named `.json` is the final node checkpoint. The final combined coverage JSON
contains the authoritative per-migration-file report.

### Persisted behavior, rollback and races

- Original posted issue price/unit/name provenance; client price422, bad source/
  origin/current-price/date/quantity409. Unpaid2-unit return at102VND reduces only
  its original invoice by204, with stock/price source independently reconciled.
- Cumulative1VND/0.5+0.5 arithmetic is independently tested. Real backdated insertion
  changes a later immutable return1→0VND using revision2; original revision/lines
  remain unchanged, stock still records the zero-money return, historical snapshot
  survives agency rename and no zero financial entry is appended.
- Two returns compete for3sold units: only one2-unit return posts, final stock99/
  debt102. Mid-stock append failure restores draft/debt306/stock97; locked maximum
  current stock rejects a further return409/STOCK_OVERFLOW without partial effects.
- Persisted CREDIT_APPLICATION funds an issue; its actual M23 return restores the
  original cash receipt's credit98+102=200, creates no new cash/refund, and retains
  original line snapshots after product/unit rename+inactivation and agency termination.
- The reproduced protected-lot failure below is fixed: both ACTIVE reservation and
  CONSUMED paid-refund sources retain their exact original lot/receipt identity when
  the dependent return3→2VND. Stored sourceRevisionId and old posted content are immutable.

Fresh isolated0007 and populated0006→0007, repeated seed, all54SQL regressions,
down/up and unchanged frozen revisions/lots pass. Retained M16 all25 and M17–M20 all27
PG nodes pass, including full seeded seven-kind replay and real protected cash/history.
Three affected older migration-head tests also pass. Prior705-case evidence remains
historical; no fresh whole-backend claim is inferred.

### Review/deployment and handoff

Standards/spec reviews found protected-lot ownership, snapshot overwrite and missing
stock-range handling; each is fixed and reviewers confirmed source closure. Boundary
testing additionally reproduced serialized-date comparison in draft PATCH; using raw
validated field values fixes it and the real HTTP header/date/ETag case passes.
Fixture-only setup issues (transaction-local actor and termination evidence) were
corrected; required nodes were resumed, not skipped.

24direct/Nginx deployment cases pass. Docker Desktop was started on the user's
follow-up request; reviewed0007 was applied explicitly before recreating backend/
frontend. Source/image/configured Supabase0007; liveness/readiness/docs/proxy200,
live integrity410documents/30agencies/24products preserved. M24 prerequisite is ready;
M29 correction/full cancellation and full R4–R6 stay open. No current M23 core blocker.

### Earlier planning/reproduction checkpoints

2026-10-17: six owning documents prepared before code. Baseline M16–M20 evidence is
historical; no new M23 test/coverage result or schema-defect reproduction yet.

## Reproduced protected successor-lot defect at0006

Checkpoint worker `agentra-m23-rounding2` passed two real Supabase nodes:
`test_returns.py::test_backdated_return_replaces_frozen_rounding_without_mutation`
and `test_protected_rounding.py::test_protected_rounding_reproduction`.
The second node deliberately proves the defect/rollback, not completed behavior:
3VND paid invoice, later2.5-unit return worth3VND, reserve1VND, insert earlier0.5-unit
return worth1VND. Later return should become2VND and preserve the reserved1VND, but
0006/current replay returns409 CREDIT_RESERVED. Old frozen revision stays unchanged.
SQL0001 lines851–853 also require CREATED lot sourceRevisionId exactly equal to
posting revision, preventing valid successor reuse of the original immutable lot.
Observed222+seconds remote workflow had no PG blockers; stacks identify remote
queries and work completed with exit0. Worker JSON/log/coverage are in approved Temp.

Selected repair: reviewed0007 permits CREATED only from a current POSTED successor
of the SAME SALES_RETURN document while lot's original source revision remains POSTED.
All cash/agency/FK/source-kind guards remain. Lots keep original immutable source
revision/receipt IDs; M16 reconstructs their effective ownership using current source
return revision, including consumed refund keys. No cache/evidence mutation.
Fresh/populated/seed/rollback and retained M16 gates remain required before deployment.
