# M14 design

InventoryRepository builds one SQL statement with CTEs: product → complete entries
joined batch/revision/document → event sums → cumulative event balances → displayed
entry filters/keyset. Opening and closing use complete ledger before bounds;
one SQL snapshot keeps totals and rows consistent during concurrent posting.

InventoryService.statement validates bounds/sort, authenticates scoped cursors,
projects typed response and pagination. Cursor scope includes product, bounds,
source, effectiveOnly and sort. IDs/order are immutable; keyset carries exact
businessDate/order/id. Running balances are computed before descending order.

Writer helpers prelock unit/product rows sorted then balances sorted before
documents. Append copies source revision date and original document order.
Reverse only effective originals, exact negative quantity, same date/order/line.
No cache writes, commits or generic public ledger mutation endpoints.
