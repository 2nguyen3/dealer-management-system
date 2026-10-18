# M15 — Stock receipts core

Prepared 2026-10-05 before code. Prerequisite M14; second E08 slice.

Public complete operations: listStockReceipts, getStockReceipt,
createStockReceipt, updateStockReceiptDraft, postStockReceipt.
Internal branch: draft cancellation. Whole cancelStockReceipt and
correctStockReceipt remain M29-gated and are not mounted early.

Phases: receipt validator/DTOs → neutral keyed creation/header edits → ordered
atomic posting/snapshot/cache projection → internal draft cancellation → contracts,
mixed-history/backdated/rollback/race/deployment verification.

The M15 core slice is not whole-module closure. Existing returns/issues/counts in
the database are preserved and included in inventory tests. New positive receipt
postings require no financial allocation replay; they do not alter frozen prices.

See [requirements](REQUIREMENTS.md), [design](DESIGN.md), [tests](TESTS.md),
[checklist](CHECKLIST.md), [evidence](VERIFICATION.md).
