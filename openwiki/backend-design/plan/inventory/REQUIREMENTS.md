# M14 requirements

Authority: [OpenAPI](../../API/openapi.json), selected Q05/Q13/Q15, reviewed SQL
inventory_entry/assert_product and append-only ledger triggers through0006.

- `inventory.read` required, no product.manage bypass.
- Dates are half-open `[fromDate,toDate)`; reject reversed/empty intervals.
- EffectiveOnly defaults true: omit reversals and originals having a reversal.
- Full history includes both; sourceDocumentId filters displayed entries only.
- Opening/closing/balanceAfter derive from the complete product ledger, not the
  displayed page or source/effective filter. Combine each date/businessOrder event.
  D14 reproduced historical sums beyond stored quantity_value; these three response
  fields use canonical AggregateQuantity, while individual deltas remain bounded.
- Stable asc/desc order is businessDate,businessOrder,id; exact signed quantity.
- Empty product ledger returns zero opening/closing and empty page; absent product404.
- Writers append only, lock balances by product ID, retain source/date/order/unit
  and reversal references; SQL maintains caches and historical nonnegative stock.
