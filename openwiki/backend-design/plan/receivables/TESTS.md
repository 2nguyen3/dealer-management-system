# M20 tests

Confirmed read HTTP/service/PostgreSQL seams; 100% owned statements/branches.

- All six canonical contracts, permissions/single-grant balance access, no contact leaks.
- Empty/nonempty, unknown/wrong-kind/non-posted, duplicate names, terminated agency,
  all sorts/filters/date endpoints/invalid intervals, tampered and cross-scope cursors.
- Current outstanding versus initial remaining, cash/return/credit settled invoices.
- Atomic same-day charge/auto payment; openings/closings independent of display filters
  and pagination; source versus target allocation and reversal/effective semantics.
- Full-filter totals > stored Money range, consistent asOf, snapshot races and bounded pages.
- Existing seven-kind demo history, actual M17–M19 writers and later dependency sources.
- Register every actual symbol and evidence before closure.

## Actual-symbol register — 2026-10-17

Nodes are in `backend/tests/integration/workflows/` unless stated otherwise.

| Actual symbols | Success / failure / boundary evidence |
| --- | --- |
| `ReceivableRepository.__init__`, `overview`; `ReceivableService.__init__`, `overview` | `test_receivables::test_financial_reads_share_exact_balances_and_filter_independent_statement`; `test_pages::test_all_read_filters_sort_pages_and_cursor_scopes`; all filters/sorts, exact totals/common asOf, empty/literal search, invalid ranges/tampered/changed-scope/live-anchor cursor checks; changed overview anchor in `test_remaining_boundaries` |
| `ReceivableRepository.invoice`, `invoices`; `ReceivableService.invoice`, `invoices`, nested `boundary` | `test_receivables`; `test_pages` six invoice sorts/pages; `test_boundaries::test_receivable_boundaries_and_service_authorization`; unknown/wrong-kind404, non-posted409, date/sort422, changed-balance anchor400, posted/settled distinctions |
| `ReceivableService.interval`, `balance`; shared `financial.agency_balance`/`authorize_any` | `test_boundaries` invalid interval/unknown/denied; `test_authorization` three independent allowed balance grants; `tests/workflows/test_schemas.py` account-error propagation; atomic issue/auto receipt and separation balances |
| `ReceivableRepository.statement`, `allocation_source`; `ReceivableService.statement`, `allocations` | `test_receivables`; `test_pages` source/target/kind/effective/half-open/page filters independent of totals; `test_remaining_boundaries` append-only backdated reallocation; `test_review_regressions` historical1.2e18; `test_history` all seeded kinds, frozen evidence and ledger/cache reconciliation |
| `get_receivable_service`, six router functions | Six canonical contracts in `tests/workflows/test_contract.py`; real HTTP financial reads and permission/leak cases; direct/Nginx `tests/deployment/test_04_financial_workflows_smoke.py` |

DTOs have no custom validators. Historical opening/closing/running debt uses the
canonical AggregateMoney correction (D14); storage/current/invoice amounts remain Money.
Every owned file independently has exact100% statement/branch coverage in the
80-case M17–M20 owning run.
