# M23 — sales returns core

Completion2026-10-29: [M28 lines/history](../document_history/VERIFICATION.md) and
[M29 posted correction/cancel](../document_corrections/VERIFICATION.md) are published.
Immutable return-credit lots and reserved/paid refund provenance remain protected.
Original core scope below is historical; whole R5/R6 remains separate.

Prepared 2026-10-17 before code. Direct prerequisite M20; execute after M21/M22 packet.
Own listSalesReturns/getSalesReturn/createSalesReturn/updateSalesReturnDraft/postSalesReturn
and internal draft cancellation. Full posted correction/cancel belong to completed M29;
public line/history operations to completed M28. Publish only after complete gates.

Vertical slices: source-bound draft/prices → cumulative rounding → stock+financial
posting → immutable dependent-return replacement → protected provenance → full tests.
No automatic refund, provider call, manual allocation or replacement client price.

## Verified checkpoint2026-10-18

Core passes21owning cases and exact250/50 coverage over7module files plus0007 Python
revision. Reviewed0007 resolves concrete protected-lot successor failure with fresh/
populated/seed/down-up evidence. See [VERIFICATION](VERIFICATION.md). Full posted
correction/cancel stays M29; next dependent reader M24 is verified.
