# M19 requirements

- Verify requires cash.upfront.verify, exact current READY revision/PENDING issue,
  positive immediatePayment match, CASH/BANK_TRANSFER and timezone-aware receivedAt.
- One immutable confirmation per revision. VERIFIED alone affects no balance.
- Read any cash.upfront.verify/cash.receipt.post/stock.issue.post.
- Issue posting requires only stock.issue.post, consumes VERIFIED once and creates
  one AUTO_FROM_ISSUE receipt allocated only to its original issue at the same checkpoint.
- Evaluate net debt after atomic issue+receipt, never reject an intermediate gross charge.
- Failure retains VERIFIED evidence. Separate requires cash.receipt.post + If-Match +
  idempotency key and records full cash as RECEIVED_UNAPPLIED at receivedAt's Vietnam date.
- Eligible FIFO reduces debt; excess becomes same-source credit. No implicit issue cancel.
- Separated evidence cannot be consumed again; replacement retains old history and
  rejects still-VERIFIED evidence. M29 owns paid issue cancellation orchestration.
