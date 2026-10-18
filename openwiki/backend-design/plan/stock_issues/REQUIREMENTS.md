# M17 requirements

- Seven ultimately published operations: listStockIssues, getStockIssue,
  createStockIssue, updateStockIssueDraft, submitStockIssue, replacePendingStockIssue,
  postStockIssue. The last two require M19 in this delivery.
- Read any stock.issue.prepare/post/debt.read/sales.read; prepare and post remain separate.
- ACTIVE agency, businessDate >= acceptedDate; immutable agency; strict exact quantities,
  unique products, active products/units and usable server-derived selling prices.
- Draft has no stock/debt effect; 0 <= immediatePayment <= rounded total. Submit
  refreshes snapshots/rate/limit, checks stock and anticipated net debt, freezes READY.
- READY snapshots survive master changes. Post rechecks current eligibility/stock/limit,
  preserves historical nonnegative inventory and replays financial history chronologically.
- Commands are actor/operation/resource scoped; stale/missing ETags 412/428, replay
  reauthorizes after waits; commit/constraint failures roll back all writes/audit/results.
- Pending replacement preserves READY history; VERIFIED money must first be separated.
- D16 positive stored price and D17 existing return/credit/refund replay are publication gates.
