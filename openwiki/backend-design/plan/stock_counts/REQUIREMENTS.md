# M22 requirements

Q01/Q05/Q15 and canonical stock-count contract govern the lifecycle.
stock.count is required throughout; nonzero confirmation also requires
stock.adjustment.post, including replay access after command wait.
Input headers countedAt/reason, line productId/countedQuantity; no client snapshot.
Header patch preserves snapshot; line patch changes count only, product immutable.
Create may be empty. Confirm must have lines. Keep zero differences; never create
empty adjustment. Recount requires countedAt, nonblank reason and exactly the full
existing product set, with fresh counted quantities. No delete or confirmed edit.

Capture both currentStock and max inventory-entry ID under stock locks. Away/back
stock movement invalidates confirmation even if quantity is equal. 409 code is
STALE_STOCK_SNAPSHOT. Nonzero count needs nonblank reason. Adjustment date is Vietnam
date of countedAt. Count/link and M21 posting commit atomically, observations frozen.
Canonical filters/sorts/pagination/ETags/statuses/UUID keys/media remain authoritative.
