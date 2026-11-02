# M24 verification

## 2026-10-18 — credit-reader scope verified

M23's verified prerequisite is satisfied. Three owned credit endpoints and the
caller-owned AvailableCreditService are delivered; M20 still owns the sole shared
agency-balance route. **8 owning cases**:4offline+4real PG, with additional M23
credit-funded return integration. Actual symbols/nodes: [TESTS](TESTS.md).

**Exact scope:**6files in `app/modules/agency_credit/`,136statements/12branches,
100% independently per file, zero missing/excluded statements or missing/partial
branches. Full affected-production scope30files/1162statements/162branches also
passes exact100%, including changed shared code and reviewed0007 Python migration.

### Actual final commands/checkpoints

From backend/ with explicit SUPABASE_TEST_SCHEMAS=1 supplied by the worker:

```powershell
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-final-m24 tests/integration/agency_credit -m integration -vv --tb=short --maxfail=1 -o faulthandler_timeout=180 --cov=app.modules.agency_credit --cov-branch --cov-report=term-missing --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-final-m24-coverage.json
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-credit-history-fixed tests/integration/sales_returns/test_credit_sources.py tests/integration/agency_credit/test_reversals.py -m integration -vv --tb=short --maxfail=1 -o faulthandler_timeout=180 --cov=app.modules.sales_returns --cov=app.modules.agency_credit --cov-branch --cov-report=term-missing --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-credit-history-fixed-coverage.json
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-credit-range-boundaries tests/integration/agency_credit/test_historical_range.py -m integration -vv --tb=short -o faulthandler_timeout=180
```

First worker passed3PG cases before the reversal case was added; the second passes
M23's chain and the fourth M24 case. Third passes extended persisted opening/closing
range assertions. Current collection independently matches all4 M24 PG IDs to passing
setup/call/teardown checkpoints; no skips/xfails. All four offline cases are included
in the338-case default offline pass.

### Proven invariants

- Fully paid sale→return creates credit204 from the original cash receipt; lot source
  document/revision/receipt are correct and debt remains0. No duplicate balance route.
- Two lots200/100 with first fully reserved200: availableOnly excludes the nonzero
  balance with available0. Release restores availability200; reserve alone never
  becomes a historical debit. Internal reads take M16 writer locks and do not commit.
- All four lot sorts, both ledger sorts, tied pages, scoped cursor denial, combined
  lot/source/kind/date filters, invalid intervals/sorts and missing agency/lot pass.
  Whole-agency closing300 remains independent of the one-lot/page display filter.
- A backdated issue before excess cash reverses CREATED100 with −100: both rows are
  ineffective, share final atomic balance0, preserve reversal/source identity, and
  zero-balance historical lot remains readable while availableOnly returns none.
- A credit-funded issue's actual return retains its original receipt, statement
  CREATED/OFFSET/CREATED balances200→98→200, and no new cash receipt or refund.
- Real D14 witness below now validates canonical AggregateMoney for balanceAfter,
  opening1.2e18 and closing1.2e18, while stored/current/lot bounds stay unchanged and
  final current credit7e17 reconciles. Current reservations are not backdated debits.

Review confirmed full-ledger-before-filter semantics and protected provenance.
24direct/Nginx cases pass, including actual return-credit lot/statement reads.
Configured Supabase/source/image0007; backend/frontend healthy and direct/proxied
readiness200, live410documents/30agencies/24products preserved. All generated fixtures
are isolated from live dms and cleaned up. No current M24 blocker.

**Next module:** M25 credit_applications, after expanding its owning six-file plan.
Applications, online providers and refunds remain their M25–M27 owners; M28/M29 and
full R4–R6 gates remain open. [Program evidence](../full_backend/VERIFICATION.md)
records exact shared coverage, retained commands, deployment and node-manifest checks.

### Earlier planning/range checkpoints

2026-10-17: six owning documents prepared before code. No M24 passing test/coverage
result yet; M23 prerequisite verification remains open. Historical baseline is not a rerun.

## D14 historical credit range reproduction

Worker `agentra-credit-range2`, explicit SUPABASE_TEST_SCHEMAS=1, passed
`test_historical_range.py::test_historical_credit_can_exceed_stored_money_reproduction`:
two6e17 cash-backed credit creations and later5e17paid refund, with second receipt
backdated before payout. PostgreSQL current credit7e17 fits storage, but history1.2e18
caused the original CreditEntry.balanceAfter Money validator to fail. The initial
attempt failed fixture transaction-local actor setup; install_builders is now
reestablished at each fixture transaction. That attempt is not a domain failure.

Selected D14 alignment: canonical CreditEntry.balanceAfter and CreditStatement
openingCredit/closingCredit use AggregateMoney, matching M20 historical debt.
Stored/current/lot Money limits and signed entry values remain unchanged. Final
positive-schema regression is required; no DDL change is needed for aggregate reads.
