# M22 verification

## 2026-10-18 — all ten operations verified

M21's prerequisite core gate passes. Count headers, lines, fresh recount and atomic
confirmation are delivered with actual-symbol evidence in [TESTS](TESTS.md).
**17 owning cases**:10 canonical offline+7 real PG. M21's fractional/late-grant
consumer cases provide additional cross-module confirmation evidence.

**Exact scope:**6files under `app/modules/stock_counts/`,321statements/56branches,
100% independently in every file, zero missing/excluded statements and missing/
partial branches. Combined affected-production scope30files/1162statements/162branches
passes exact100%, including shared code and the reviewed migration.

### Actual final commands/checkpoints

From backend/, explicit SUPABASE_TEST_SCHEMAS=1 through the checkpoint worker:

```powershell
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-final-m22-lifecycle tests/integration/stock_counts/test_counts.py -m integration -vv --tb=short --maxfail=1 -o faulthandler_timeout=180 --cov=app.modules.stock_counts --cov=app.modules.stock_adjustments --cov-branch --cov-report=term-missing --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-final-m22-lifecycle-coverage.json
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-final-m22-persisted-boundaries tests/integration/stock_counts/test_guards.py tests/integration/stock_counts/test_races.py -m integration -vv --tb=short --maxfail=1 -o faulthandler_timeout=180 --cov=app.modules.stock_counts --cov-branch --cov-report=term-missing --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-final-m22-persisted-boundaries-coverage.json
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-final-count-http tests/integration/stock_counts/test_http.py -m integration -vv --tb=short -o faulthandler_timeout=180 --cov=app.modules.stock_counts --cov-branch --cov-report=term-missing --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-final-count-http-coverage.json
```

These workers pass3+3+1PG cases. Earlier three-case lifecycle and boundary/race
checkpoints also passed; source-final coverage was recollected after the unrelated
permission-race fixture failed before entering its business lock. The passing case
IDs were preserved. No skip/xfail substituted for a required test.

The first lifecycle confirms a nonzero count and immutable linked adjustment.
The second moves stock+1/−1 back to the same quantity: confirmation returns
STALE_STOCK_SNAPSHOT until a full fresh recount, then zero-only confirmation keeps
the line and creates no adjustment. Header/line changes preserve observations;
PATCH returns line body and parent ETag from the same locked transaction (review fix).
Missing/duplicate/extra recount products, fractional integer-unit counts, empty
confirmation, missing reason/conditional grant, wrong IDs, all sort/cursor scopes,
and confirmed mutation are denied appropriately. Injected failure after actual linked
posting leaves count DRAFT/link null, no adjustment and stock100 from a fresh connection.

Both independent stock-movement/confirmation winners observe real PG blocking:
count-first evidence stays valid; movement-first confirmation rejects its stale
snapshot. Real AuthService post-wait revocation is covered by M21's `[count]` case.
Fractional0.001 confirmation is also persisted through the M21 internal seam.

24direct/Nginx deployment cases pass, including the complete new four-module flow.
Source/configured Supabase0007 and healthy backend/frontend/direct/proxy readiness200;
live410documents/30agencies/24products preserved. No count or count-line DELETE is
registered. Review and [program evidence](../full_backend/VERIFICATION.md) close the
ten-operation M22 scope; public generic document history remains separately M28-owned.

### Initial planning checkpoint

2026-10-17 owning documents prepared before code. No M22 implementation/test/coverage
result yet. M21 initial3PG vertical cases pass; its final coverage/integration remains open.
