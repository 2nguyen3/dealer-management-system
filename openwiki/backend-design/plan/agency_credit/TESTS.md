# M24 tests and exact scope

Additional registered node:
`test_reversals.py::test_reallocated_credit_keeps_reversal_history_and_atomic_balances`
replays a backdated invoice before excess cash, then verifies original/reversing rows,
both ineffective, shared final checkpoint balance0, filtered current lots and retained
cash source. M23's credit-funded return case also verifies OFFSET statement rows.

Scope app.modules.agency_credit and changed shared production. Require100% statements
and branches independently in every file, no exclusions; register actual symbols/nodes.
Required: three canonical contracts/auth grants/error/media/query boundaries; shared
balance route exactly once; no source/contact leakage; source/origin receipt retained;
partially/fully reserved, released/consumed lots; availableOnly and empty pages;
time/id sorts/ties/limits/scoped cursors; wrong agency/lot404; date/order reversal and
effectiveOnly rows; totals independent of pagination/lot/source/kind display filters;
large exact history and bound numerics; internal availability no commit/live post-wait
authorization; M23 real return credit and existing refund/application effects.
Explicit SUPABASE_TEST_SCHEMAS=1, per-node checkpoint and exact coverage JSON evidence.

## Actual-symbol register

| Actual symbols | Behavior nodes |
| --- | --- |
| `schemas.CreditLot`, `CreditLotList`, `CreditEntry`, `CreditStatement` | `tests/agency_credit/test_contract.py::test_credit_contract` (three cases) and `test_agency_balance_has_one_owner`; real actual lot/statement schemas in return-credit lifecycle. |
| `CreditRepository.__init__`, `agency`, `lot`, `lots`, `statement` | `tests/integration/agency_credit/test_credit.py::test_return_credit_lots_and_statement_preserve_receipt_provenance`; `test_reservations.py::test_reserved_lot_pages_historical_totals_and_internal_availability` missing agency/lot, all four lot sorts, both ledger sorts, combined source/lot/kind/date filters, pagination-independent totals and scoped cursor denial. |
| `AgencyCreditService.__init__`, `lot`, `lots`, `statement` | Same nodes: return-funded credit204, original receipt/source retained, two lots200/100, fully reserved first excluded, reservation does not change historical300 balance, intervals/sort validation. |
| `AvailableCreditService.__init__`, `available` | Reservation node: locked no-commit credit.apply/cash.refund.post read before/after release, available0→200, no consumer side effect. |
| `dependencies.get_agency_credit_service`; router `list_agency_credit_lots`, `get_credit_lot`, `list_agency_credit_entries` | Three contracts and real HTTP lifecycle; actual false-grant new-operation matrix in M21. |

Historical-range reproduction is registered at
`test_historical_range.py::test_historical_credit_can_exceed_stored_money_reproduction`:
two6e17 credit sources, later5e17 payout and backdated second receipt give historical
1.2e18/current7e17. Canonical AggregateMoney resolution and persisted wide
opening/closing/balanceAfter schema assertions now pass; current/lot limits are unchanged.
