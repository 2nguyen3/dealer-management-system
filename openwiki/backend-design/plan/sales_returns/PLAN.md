# M23 — sales returns core

Prepared 2026-10-17 before code. Direct prerequisite M20; execute after M21/M22 packet.
Own listSalesReturns/getSalesReturn/createSalesReturn/updateSalesReturnDraft/postSalesReturn
and internal draft cancellation. Full posted correction/cancel remain M29; public
line/history operations remain M28. Five operations publish only after complete gates.

Vertical slices: source-bound draft/prices → cumulative rounding → stock+financial
posting → immutable dependent-return replacement → protected provenance → full tests.
No automatic refund, provider call, manual allocation or replacement client price.

## Verified checkpoint2026-10-18

Core passes21owning cases and exact250/50 coverage over7module files plus0007 Python
revision. Reviewed0007 resolves concrete protected-lot successor failure with fresh/
populated/seed/down-up evidence. See [VERIFICATION](VERIFICATION.md). Full posted
correction/cancel stays M29; next dependent reader M24 is verified.
