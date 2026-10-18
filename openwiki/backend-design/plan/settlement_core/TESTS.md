# M16 tests and actual-symbol register

2026-10-17 extension: `replay._timeline`'s final current-balance range guard is
additionally covered through `plan_replay` by
`tests/settlement_core/test_review_regressions.py::test_current_balance_storage_boundary_returns_a_business_conflict[debt]`
and `[credit]`, plus persisted wide-history/posting rollback in the M17–M20 review
regression. Current M16 gate:30pure+25PG,477statements/208branches exact100%.
The original checkpoint register below retains its historical counts.

Gate: exact100% statements and branches in every M16 runtime file, with retained
combined M01–M15 regression. Required tests never skip/xfail. Pure algorithms use
independent expected allocations/conservation examples, not mock call counts.

| Symbol group | Success | Failure | Boundary |
| --- | --- | --- | --- |
| Exact validation/event models | typed finite integer money | float, bool, fraction, invalid identity/kind | zero permitted return, max Money |
| FIFO | multiple partial/full invoices, date/order sorting | manual overpay, wrong agency/target | exact debt, future invoice, equal-date order |
| Provenance pairing | multi-lot/invoice conserved sweep | mismatched totals, duplicate sources | split across both axes, repeated return/application |
| Replay | backdated issue/receipt changes later FIFO, all persisted financial kinds | historical deficit, protected-source destruction | atomic auto receipt, unchanged no-op, zero return |
| Repository | historical/current ledger reads, immutable append/reversal | missing agency/source/batch, exact source mismatch | absent/empty history, type discovery restart |
| Receipt service | caller-owned posting, correct snapshot/full cash | wrong kind/state/agency/date/evidence, post-wait denial | duplicate retry, commit failure, simultaneous receipts |
| Reservations | same-source reserve/release/consume | insufficient credit, wrong source, UNKNOWN release, repeated state | full available amount, competing reserve/consume |

Commands from backend/: `uv run pytest tests/settlement_core -q --tb=short`;
explicit guarded BUSINESS_TEST_DATABASE_URL then
`uv run pytest tests/integration/settlement_core -m integration -q --tb=short`.
Combined command from the verification workflow includes all M16 tests and the
existing PG/TLS/migration/seed tests. Use real independent sessions with observed
PG waits for concurrency. Injection after an appended ledger leg and failing
constraint/commit must roll back source/batches/ledgers/lots/audit together.

Persisted full seed replay must preserve frozen revisions and terminal provider/
upfront/refund evidence and reservations; valid insertion before later dependent
kinds must either replay correctly or demonstrate a genuine invariant conflict.

## Actual symbols and behavior evidence

Paths below use `O=backend/tests/settlement_core/` and
`P=backend/tests/integration/settlement_core/`. All listed runtime symbols are in
`backend/app/modules/settlement_core/`; generated frozen-dataclass access/equality
methods have no independent domain validation. Their consuming boundaries validate
inputs, and real PG enforces FK/immutable identity/source rules.

| Actual symbol | Success / failure / boundary cases |
| --- | --- |
| `allocation.money` | O/test_allocation.py: exact max/zero; ten inexact/invalid/overflow cases |
| `allocation.plan_fifo` | O/test_allocation.py: original-order partial/full/linked/future/zero dues; duplicates/wrong agency/overpay |
| `allocation.pair_credit_provenance` | O/test_allocation.py: ordered cross-axis conservation, empty pair, mismatched totals/zero cash; O/test_replay.py repeated application/return |
| `models.Invoice`, `Allocation`, `CashSlice`, `CashPair`, `LotKey`, `Lot`, `Event`, `Leg`, `ReplayPlan` | O/test_allocation.py, test_replay.py, test_review_regressions.py: immutable typed records, identity equality/order, validated invalid event/amount data, duplicate lots/sources, zero/max boundaries |
| `replay.validate_event` | O/test_replay.py: every registered kind, strict IDs/date/agency, receipt method/type, missing origin, zero return |
| `replay.plan_replay` | O/test_replay.py: empty/chronological/duplicate/invalid inputs; P/test_replay.py full seed and append-only reallocation |
| `replay._timeline` | O/test_replay.py and test_review_regressions.py: charges, atomic auto, manual/excess, credit chains, protected refunds, neutral kinds, zero/over-return; P/test_provenance.py real mixed-history insertion/rollback |
| `replay._create_credit` | O/test_review_regressions.py: new-lot persistence order, duplicate-origin protected minima, zero omitted leg, true protected deficit; P/test_provenance.py reserved/paid duplicate-lot replay |
| `replay._consume_credit` | O/test_replay.py: oldest eligible source, insufficient/unreserved credit; O/test_review_regressions.py future paid protection and same-day stable ordinals; P/test_reservations.py both-order exclusion |
| `service.normalized_legs` | O/test_replay.py/test_review_regressions.py: merged repeated same-origin slices, zero/empty/changed plans; domain input failures handled by validated replay boundary |
| `SettlementRepository.__init__` | P/test_posting.py: real session ownership and missing-source paths; rollback closes caller session without repository commits |
| `SettlementRepository.lock_agency` | P/test_guards.py: actual independent type change/40001 restart; P/test_posting.py missing agency; P/test_races.py real balance wait |
| `SettlementRepository.lock_history` | P/test_races.py/test_reservations.py: observed waits, serialized source/lot effects; post-wait permission failure and empty history |
| `SettlementRepository.source` | P/test_posting.py: full source, wrong kind, missing404, frozen states; P/test_reservations.py same-agency/source failure |
| `SettlementRepository.lots` | P/test_replay.py/test_provenance.py: full seed, created/reserved/provenance projections, duplicate-source lots and empty history |
| `SettlementRepository.events` | P/test_replay.py: all seeded financial sources; P/test_posting.py auto issue order; P/test_reservations.py exact consumed refund identities |
| `SettlementRepository.effective` | P/test_replay.py/test_provenance.py: active replacements versus immutable originals; P/test_posting.py invalid ledger; empty current effects |
| `SettlementRepository.ensure_lot` | P/test_posting.py/test_provenance.py: excess/new origins; P/test_guards.py unchanged existing identity; SQL original source FK checks remain authoritative |
| `SettlementRepository.append`, `reverse` | P/test_replay.py/test_provenance.py: both ledgers, exact old date/order/source reversals; P/test_posting.py invalid ledger/append-only DB rejection and failure after append rollback |
| `SettlementRepository.available`, `balance` | P/test_posting.py/test_reservations.py: unflushed current/historical ledger totals, reservations, same-source/no-source filter; missing agency404 and no lots |
| `SettlementRepository.reservations`, `blocked_attempt` | P/test_reservations.py: ACTIVE/RELEASED/CONSUMED, actual UNKNOWN online attempt blocks release, absent rows and terminal state |
| `SettlementRepository.reserve`, `finish_reservations` | P/test_reservations.py: bound inserts/transitions, repeated reservation/terminal state blocked, full amount and rollback; P/test_posting.py invalid state |
| `SettlementService.__init__`, `lock` | P/test_posting.py: real sessions, caller whitelist, post-lock denial; P/test_races.py actual AuthService grant revocation after PG wait |
| `SettlementService.replay` | P/test_replay.py/test_provenance.py: chronological insertion/no-op and preserved frozen evidence; P/test_guards.py limit/protected partial refund conflict; P/test_posting.py injected append/commit rollback |
| `SettlementService.post_receipt` | P/test_posting.py: manual/online/auto snapshots, own checkpoint/full excess, future/overpay/wrong state/date, rollback, no implicit commit; P/test_reservations.py actual separated cash; P/test_races.py competing receipts |
| `ReservationService.refund`, `reserve` | P/test_reservations.py: source ownership, full reserve, wrong kind/agency, cash cap, repeated/insufficient/UNKNOWN paths, two-reservation one-winner |
| `ReservationService.release`, `consume` | P/test_reservations.py: one terminal transition, rollback, exact paid debit, incomplete/full amount and UNKNOWN/repeated denial; P/test_provenance.py immutable source under backdated replay |

Final scope: M16 **474 statements/208 branches, zero missing**. Whole retained
scope4096/830, exact100%;617 passed without skip/xfail. Commands/results belong in
[VERIFICATION](VERIFICATION.md).
