# M25 requirement traceability

- Q10: explicit accounting confirmation consumes credit; it never receives new cash.
- Q07/D06/D17: replay later financial sources, including existing returns/applications/
  reservations/paid refunds; preserve immutable evidence and current/historical bounds.
- D08/0007: source-date/lot-ID credit sweep and invoice FIFO retain original receipt
  origins through subsequent return/application chains and protected original lots.
- Canonical CreditApplicationCreateRequest: immutable agency, businessDate, strictly
  positive bounded Money, nullable note. FinancialUpdateRequest permits date/amount/note.
- Canonical detail cashReceived is literal string `0`; no payment receipt is created.
- Read any credit.apply/debt.read; create/update/post credit.apply; internal cancellation
  documents.cancel. Live authorization is repeated after command claims and lock waits.
- Required If-Match for update/post; Idempotency-Key for create/post/cancel. Shared
  durable command semantics recover same-key success before stale-token comparison.
- Drafts are balance-neutral; post requires the whole amount to fit historical eligible
  debt and historical unreserved credit. Future sources cannot fund an earlier event.
- Status, errors, headers and pagination derive from the five canonical operations;
  posted correction/full cancellation are explicitly deferred to M29.
