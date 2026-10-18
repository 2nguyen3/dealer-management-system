# M17 verification

## 2026-10-17 owning gate

User confirmed HTTP/service/persisted-state/rollback/race seams. All four six-file
plans preceded code. M17 core and M19 money integration now have passing evidence;
whole-module posted correction/cancel remains M29. Actual-symbol mapping: [TESTS](TESTS.md).

From `backend/`, using the installed frozen environment and explicit
`$env:SUPABASE_TEST_SCHEMAS='1'` (no Docker database):

```powershell
$env:COVERAGE_FILE='.coverage-workflows'
uv run --frozen --no-sync pytest tests/workflows tests/integration/workflows -m "not deployment" -q --tb=short --cov=app.modules.stock_issues --cov=app.modules.payment_receipts --cov=app.modules.upfront_payments --cov=app.modules.receivables --cov=app.modules.document_core.financial --cov=app.modules.document_core.list_repository --cov-branch --cov-report=term-missing --cov-report=json:workflow-coverage.json --cov-fail-under=100
```

**PASS:80 cases, 808 statements/98 branches, exact100%**, every owned/shared file
zero missing/excluded statements and zero missing/partial branches. Includes27 real
PostgreSQL cases and53 offline input/contract cases; no required skip/xfail.

Independent connections prove overselling rejection, duplicate-intent single result,
competing cash consumption, post/separate both lock orders, late grant revocation
and same-key claim-wait replay authorization. Commit-failure tests compare complete
persisted document/revision/line/batch/stock/debt/credit/evidence/audit/command state.
Mixed-history test seeds twice, runs54 rolled-back SQL regressions, rejects a genuinely
invalid historical cash-source change, then accepts fully paid backdated posting and
valid manual collection without changing existing frozen revisions/payment evidence.

Review caught repriced-line overflow before range validation and unhandled final
financial-balance overflow; both now return409 and leave state unchanged. D14's
real1.2e18 historical debt witness widened only statement aggregate response fields.
Both review axes confirmed their original findings closed; strengthened assertions
also verify409/TOTAL_OVERFLOW and sole stock.issue.post auto-receipt permission.

## Deployment

Docker image build passed. With temporary API/Nginx containers on loopback18000/18080,
isolated Supabase schema seeded with the full demo, command:

```powershell
$env:AUTH_SMOKE_DIRECT_URL='http://127.0.0.1:18000'
$env:AUTH_SMOKE_PROXY_URL='http://127.0.0.1:18080'
$env:AUTH_SMOKE_TIMEOUT_SECONDS='90'
uv run pytest tests/deployment -m deployment -q --tb=short
```

**PASS:22 direct/Nginx cases**. First attempt19passed/3remote read timeouts at the old
10second budget; final run above supersedes it. Isolated smoke containers/schemas
were removed. No Docker PostgreSQL container was created.

Normal backend was restarted from the latest image; explicit
`docker compose exec -T backend alembic upgrade head` migrated configured Supabase
0002→0006. `alembic current` reports0006; `python -m app.db.verify --seeded` passes
30tables and document/ledger/cache/audit/report integrity, retaining410documents,
30agencies and24products. Demo login200, all four new collection reads200, logout204;
runtime schema contains82operations (80target+2health).

Retained M01–M16 regression now passes all370current PostgreSQL/TLS nodes across
checkpointed/resumed runs. Current offline selection passes308cases; including27owning
PG cases gives705non-deployment cases, plus22deployment cases. Exact final evidence,
worker commands and cleanup are in [program verification](../full_backend/VERIFICATION.md).
Combining owning coverage with the affected M16 pure/PG evidence yields33production
files/1285statements/306branches exact100%; no missing/excluded lines or branches.
This is not a fresh whole-backend or test-harness coverage claim. M17 core closes;
posted correction/full cancellation remain M29. Next code slice is M21.
