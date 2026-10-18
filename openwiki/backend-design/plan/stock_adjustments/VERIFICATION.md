# M21 verification

## 2026-10-18 — core scope verified

Five full operations and internal draft cancellation are delivered. Posted correction/
full cancellation stay M29-owned; public shared document lines/history stay M28.
Owning register: [TESTS](TESTS.md). **13 owning cases**:5 canonical offline+8 real PG.
The fractional stock case also exercises M22's internal adjustment consumer.

**Exact scope:** all6 `app/modules/stock_adjustments/*.py` files,
161statements/24branches,100% in every file, zero missing/excluded statements or
missing/partial branches. The final affected-production gate additionally includes
changed shared code and migration:30files/1162statements/162branches, exact100%.

### Actual final commands/checkpoints

From backend/, using the frozen environment and explicit SUPABASE_TEST_SCHEMAS=1:

```powershell
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-final-m21 tests/integration/stock_adjustments/test_adjustments.py tests/integration/stock_adjustments/test_guards.py -m integration -vv --tb=short --maxfail=1 -o faulthandler_timeout=180 --cov=app.modules.stock_adjustments --cov-branch --cov-report=term-missing --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-final-m21-coverage.json
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-post-wait-auth-fixed tests/integration/stock_adjustments/test_lock_authorization.py -m integration -vv --tb=short --maxfail=1 -o faulthandler_timeout=180 --cov=app.modules.stock_counts --cov=app.modules.stock_adjustments --cov-branch --cov-report=term-missing --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-post-wait-auth-fixed-coverage.json
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-fractional-stock tests/integration/stock_adjustments/test_fractions.py -m integration -vv --tb=short -o faulthandler_timeout=180
```

Final workers respectively pass4,2,1PG cases. `agentra-new-auth` passes the eighth
case (all23 new HTTP operations deny real false grants). The338-case default offline
run includes all five M21 canonical cases. Complete commands for shared coverage,
retained55PG and24direct/Nginx cases are in [program evidence](../full_backend/VERIFICATION.md).

Real final connections verify signed stock30 after competing70-unit withdrawals,
historical-negative rollback, no financial entries, unchanged receipt price source,
and no command/audit/document/ledger residue after injected mid-append failure.
Fractional +1.125/−0.125 and count+0.001 preserve unpriced stock0-price/source-null;
integer-unit fractions and recorded fraction-policy changes are rejected.
Real AuthService grants revoked during observed stock blocking deny both independent
post and count confirmation. The first permission-race attempts omitted the required
delivery collaborator; a stage barrier exposed this fixture error, then the real
app delivery object was injected. No production authorization bypass was introduced.
Passing nodes were preserved; the affected coverage batch was recollected separately.

Standards/spec review findings were fixed and rechecked.24deployment cases pass,
including both direct/proxy adjustment→count→sale→cash→return→credit workflows.
Configured Supabase/current image are0007; backend/frontend healthy, direct/proxied
readiness200. Live410documents/30agencies/24products are preserved. The one generated
namespace left by the initial120s interrupted M21 worker was removed by exact UUID
and fixture marker after workers exited; live counts unchanged. No Docker database,
commit or push. Current packet has no unresolved M21 core blocker.

### Earlier checkpoints (historical within this packet)

2026-10-17: owning materials prepared before code; implementation/testing gates open.
Prior M17–M20 results are historical baseline, not rerun results.
Initial `git status --short` inspected: substantial pre-existing uncommitted work retained.
`docker compose ps`: existing dms-backend-1 healthy; no database container.
No new test result or coverage claim yet.

## Initial vertical slice checkpoint

`uv run --frozen --no-sync alembic current`: 0006 (head).
`uv run --frozen --no-sync pytest tests/stock_adjustments -q --tb=short`:
3 passed/2 failed, reproduced response nullability mismatch; StockAdjustment's
agencyId/receiptType/status narrowed to canonical contract. Rerun pending.

With explicit `SUPABASE_TEST_SCHEMAS=1`:
`uv run --frozen --no-sync pytest tests/integration/stock_adjustments/test_adjustments.py::test_signed_stock_only_lifecycle_and_retries -m integration -vv --tb=short -o faulthandler_timeout=90 --cov=app.modules.stock_adjustments --cov-branch --cov-report=term-missing --cov-report=json:coverage-m21.json`
passed 1 case in140.31s. Stack at90s showed psycopg remote command query, later completed.
Earlier120s tool-terminated attempt is not a passing run; possible orphan schema needs cleanup.

`uv run --frozen --no-sync pytest tests/integration/stock_adjustments/test_adjustments.py::test_invalid_history_and_inputs_are_atomic tests/integration/stock_adjustments/test_adjustments.py::test_competing_negative_posts_preserve_stock -m integration -vv --tb=short --maxfail=1 --cov=app.modules.stock_adjustments --cov-branch --cov-append --cov-report=term-missing --cov-report=json:coverage-m21.json`
passed2cases in152.47s. Independent final connection confirms stock30 after one70-unit
withdrawal and competing rejection; negative-before-first-receipt rolls back.
Current interim scope161statements/24branches,8missing statements/8partial branches;
coverage gate remains OPEN. Initial Ruff format passed11files (6 reformatted).
