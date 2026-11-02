# M19 upfront payments and issue-money integration

Completion2026-10-29: [M29 issue cancellation](../document_corrections/VERIFICATION.md)
now closes the pending original-period/full-money separation gate, including READY
evidence and POSTED automatic receipts. Original core and native gateway evidence
remain separately retained; full release/terminal bank settlement is not inferred.

Active 2026-10-17 after M18. Deliver four upfront operations and finish M17
postStockIssue/replacePendingStockIssue. Real-money preservation is atomic across
issue, receipt, stock, debt, credit, evidence, audit and command result.

Read [requirements](REQUIREMENTS.md), [design](DESIGN.md), [tests](TESTS.md),
[checklist](CHECKLIST.md), [verification](VERIFICATION.md) and the
[canonical contract](../../API/openapi.json). Gateway integration remains M26.
