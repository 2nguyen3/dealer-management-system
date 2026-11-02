# M21 — stock adjustments core

Completion2026-10-29: [M28 lines/history](../document_history/VERIFICATION.md) and
[M29 posted correction/cancel](../document_corrections/VERIFICATION.md) are published.
Confirmed-count adjustments remain immutable. Original core scope below is historical;
the dependent owning operation inventory is complete, not whole R5/R6.

Prepared 2026-10-17 before implementation. Prerequisite: verified M15.

Deliver listStockAdjustments, getStockAdjustment, createStockAdjustment,
updateStockAdjustmentDraft and postStockAdjustment, plus internal cancel_draft.
Full cancelStockAdjustment/correctStockAdjustment belong to completed M29; public lines to completed M28.
Canonical contract: ../../API/openapi.json; SQL authority: backend/alembic/sql/0001–0006.

Sequence: strict inputs → neutral draft/read → signed stock posting → count seam →
persisted rollback/races/contract → exact coverage → deployment and review.
Do not publish unverified or partial target operations.

## Verified checkpoint2026-10-18

Core passes13owning cases and exact6-file161/24 coverage; packet338offline+84PG+
24deployment and affected30-file1162/162 exact100%. Current source/configured head0007.
See [VERIFICATION](VERIFICATION.md); only the declared core closes, M28/M29 remain open.
