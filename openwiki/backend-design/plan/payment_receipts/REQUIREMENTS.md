# M18 requirements

- Manual DEBT_COLLECTION, CASH/BANK_TRANSFER only; positive whole VND, immutable agency.
- TERMINATED agencies may repay; date cannot precede acceptance.
- Read any cash.receipt.prepare/post/debt.read; prepare/post permissions distinct.
- Draft/header changes do not allocate money. Post freezes contact snapshots and
  allocates exactly the full amount FIFO at business date/order, excluding future invoices.
- Manual overpayment is rejected; no intentional surplus credit. Existing online,
  automatic and RECEIVED_UNAPPLIED receipts are protected from standalone mutation.
- Backdated posting replays later allocations while preserving actual received money,
  source provenance, active/paid refunds and all seeded persisted kinds.
- Scoped idempotency, ETags, exact outputs, live authorization and rollback are mandatory.
