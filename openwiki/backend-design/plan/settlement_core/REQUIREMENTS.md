# M16 requirements and traceability

| ID | Requirement | Authority |
| --- | --- | --- |
| S01 | Allocate against same-agency invoices eligible at businessDate/businessOrder; original invoice FIFO, stable identity tie break | Selected Q06; assert_document FIFO |
| S02 | Automatic issue receipt uses issue checkpoint and targets only that issue | Q02; assert_document/guard_ledger AUTO_FROM_ISSUE |
| S03 | Manual DEBT_COLLECTION must allocate fully; ONLINE/RECEIVED_UNAPPLIED preserve full actual cash and excess credit | Q11; assert_document cash reconciliation |
| S04 | Credit retains original receipt through multi-lot/multi-invoice application and repeated returns | Q08/Q10; D08; credit_lot originReceiptId |
| S05 | Credit consumption excludes ACTIVE reservations; refunds use one original receipt and reserve/release/consume once | Q10; assert_refund/assert_agency/guard_evidence |
| S06 | Valid backdated new posting recalculates later allocations; nonnegative historical invoice/lot balances and current credit/debt/limit | Q05/Q07; D06; assert_agency |
| S07 | Append reversals and replacements; preserve dates, original orders, frozen revisions and real-money evidence | Q03/Q04; guard_ledger/guard_revision |
| S08 | Caller-owned transaction, no cache mutation, live permission after waits, atomic rollback | Backend guidance; full-backend DESIGN |
| S09 | All persisted dependency kinds have explicit financial replay/protection capabilities; HTTP publication remains owning-module gated | D17; full-backend EXECUTION |

SQL authority: immutable0001 plus reviewed0005/0006 guards. Target OpenAPI is the
single public contract. No schema migration is assumed: D08 uses deterministic
pairing of effective immutable credit debits ordered by source-lot date/id and
invoice allocation legs ordered by original invoice date/order/id; conservation
and reconstruction must pass before claiming this seam. Exact VND amounts are
Decimal integers; input float/bool/fraction/NaN/infinity/overflow are rejected.

An actual cash refund and active/unknown attempt remain protected, never silently
reallocated to another cash source. A changed history with insufficient historical
debt/credit or destroyed protected provenance is a genuine business conflict.
