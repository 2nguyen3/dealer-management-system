# Full frontend — Execution

**Prepared:** 2026-10-03. **Status:** planning + static wireframes; no business frontend implementation. The [General Plan](../../GENERAL_PLAN.md) controls dependencies and [General Checklist](../../GENERAL_CHECKLIST.md) tracks evidence.

## Paired authoring and implementation sequence

| Packet | Paired plan + wireframe deliverable | Publication/verification boundary |
| --- | --- | --- |
| U01 | F01–F03 and shared CSS/navigation, session/error/shell screens | F01 offline design; real M01 auth only after environment evidence. |
| U02 | F04–F07 administration/audit | M03–M06 published; next-request grants and account invalidation. |
| U03 | F08–F13 catalogues and dealer profiles | M07–M12 published; D02/D16 as relevant. |
| U04 | F14–F17 workbench/inventory/receipts/issues | M13–M19 partials; lines, full issue post/cancel await M28/M29/R5. |
| U05 | F18–F20 manual receipts/upfront/receivables | M18–M20 plus supported persisted later kinds; M29 correction paths. |
| U06 | F21–F25 stock adjustments/counts/returns/credit | M21–M25; count evidence, cumulative return price and provenance. |
| U07 | F26–F27 online and refunds | M26–M27, accepted sandbox, UNKNOWN/reconcile and reservations. |
| U08 | F28–F29 history/print/corrections | M28–M29/R5; whole operational workflow handoff. |
| U09 | F30–F32 reports/dashboard/chatbot | M30–M32/R6 plus D09/D10 resolved. |
| U10 | Cross-system release and accessibility/browser acceptance | Full operation manifest, live HTTP, all deferred reader regressions. |

Within a packet, plan and HTML authoring proceed together from a common screen/action inventory and one synthetic fixture ledger. Do not declare an individual child ready until HTML files and state anchors, links, screenshots/manual review evidence and documentation agree. Parallel authoring does not relax the [39-edge frontend dependency graph](../../GENERAL_PLAN.md#5-frontend-dependency-graph). First and Full backend gates are read from source inventory; R3/R4 are not sufficient for complete document consumer handoff.
