# M24 requirements

Canonical Agency Credit contracts and Q10/D08/D14/D17 govern reads.
Lot detail/list accept any debt.read/credit.apply/cash.refund.post; statement debt.read.
Return original source document/revision/receipt, exact balance/reserved/available.
availableOnly means available>0, including fully reserved nonzero-balance exclusion.
ACTIVE reservations reduce availability, RELEASED/CONSUMED do not reserve twice;
refund debit belongs in historical ledger only when paid. Do not net debt/credit.

Statement opening/closing and balanceAfter derive from complete agency chronology,
before date/source/lot/kind/effective/page display filters. Same business checkpoint
uses final atomic balance. Half-open dates, deterministic date/order/id keyset;
current reservations never become backdated credit debits. Lot pages use time/id
sort and agency/filter-scoped cursors. Missing agency/lot404; permissions before data.
M25–M27 own consuming workflows. Shared availability never commits a caller transaction.
