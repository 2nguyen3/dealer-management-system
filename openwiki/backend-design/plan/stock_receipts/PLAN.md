# M15 — Stock receipts core

Completion2026-10-29: core plus full posted correction/cancellation are published.
The original core scope below is historical; [M29 closure evidence](../document_corrections/VERIFICATION.md)
supplies replay/protection/rollback/races and runtime publication, not a rerun claim
for every historical M15 case. Whole R5/R6 remain separate.

Prepared 2026-10-05 before code. Prerequisite M14; second E08 slice.

Public complete operations: listStockReceipts, getStockReceipt,
createStockReceipt, updateStockReceiptDraft, postStockReceipt.
Internal branch: draft cancellation. Whole cancelStockReceipt and
correctStockReceipt were originally M29-gated; that gate is now closed as linked above.

Phases: receipt validator/DTOs → neutral keyed creation/header edits → ordered
atomic posting/snapshot/cache projection → internal draft cancellation → contracts,
mixed-history/backdated/rollback/race/deployment verification.

The M15 core slice is not whole-module closure. Existing returns/issues/counts in
the database are preserved and included in inventory tests. New positive receipt
postings require no financial allocation replay; they do not alter frozen prices.

See [requirements](REQUIREMENTS.md), [design](DESIGN.md), [tests](TESTS.md),
[checklist](CHECKLIST.md), [evidence](VERIFICATION.md).
