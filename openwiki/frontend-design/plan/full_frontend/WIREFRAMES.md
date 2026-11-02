# Full frontend — Wireframes

**Prepared:** 2026-10-03. **Status:** planning + static wireframes; no business frontend implementation. The [General Plan](../../GENERAL_PLAN.md) controls dependencies and [General Checklist](../../GENERAL_CHECKLIST.md) tracks evidence.

## HTML experience contract

Open [wr/index.html](../../wr/index.html) locally. Each F01–F32 folder contains a real `index.html` plus topic-specific pages listed in [MODULES](MODULES.md). Relative links, one CSS file and one small local JavaScript enhancement work without API or a build. Screen markup is substantive with navigation, labels, field values, source operation badges and explicit scenario variants; JS adds filtering/scenario switching and local-only confirmation notices. Semantic headings/tables, focus styles, keyboard inputs, narrow layouts and textual statuses are required.

The [linked business flow index](../../wr/flows.html) covers verified upfront money, failed shipment, FIFO settlement, online excess credit, returns versus refunds, UNKNOWN reservations, stale count, historical blocker, correction replay and full-filter export. A page's synthetic action does not cause a server mutation. Look for the prototype notice at the top of every screen.

One screen/action/operation may have multiple states in a single page or separate exception page; every listed state must be reachable through explicit anchors or scenario links. Shared state gallery F01 does not replace domain-specific exception content. F29's six pages present correction in its owning document context. No bulk import, generic job center, dealer login, tax invoice or manual FIFO allocation screen is included because the source does not provide those operations.
