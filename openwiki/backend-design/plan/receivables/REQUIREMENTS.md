# M20 requirements

- debt.read throughout; shared balance accepts any debt.read/credit.apply/cash.refund.post.
- Overview returns minimal financial agency identity, both ACTIVE/TERMINATED by default,
  full-filter exact aggregate totals and one common asOf snapshot, independent of pages.
- Distinguish current debt/credit, reserved/available credit, current limit and initial
  remainingAtIssue. SETTLED includes cash, credit application and returns.
- Invoice balance exists only for POSTED STOCK_ISSUE; wrong kind/missing 404,
  existing non-posted/cancelled issue 409.
- Statements use complete atomic date/order checkpoints before display filters;
  half-open dates, source/target/kind filters, effective and full reversal history.
- Allocations select source receipts/returns/applications or target issue; reject other kinds.
- Exact decimal strings, immutable ledger cursors and safe snapshot-aware overview/
  invoice pagination; unknown/changed-scope anchors fail rather than silently skip.
- Include already persisted returns/credit/refunds and large valid historical aggregates.
