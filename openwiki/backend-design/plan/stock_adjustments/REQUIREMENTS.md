# M21 requirements

- Q01/Q05/Q13/Q15: nonzero signed quantities, integer/fraction unit policy,
  historical nonnegative stock, no change to purchase-price provenance.
- Required nonblank reason, price and total zero; no agency, sales or financial legs.
- Read any stock.adjustment.prepare/stock.adjustment.post/inventory.read;
  create/patch prepare; post post; internal cancellation documents.cancel.
- Confirmed count-linked evidence cannot be independently edited, posted or canceled.
- Create/post/cancel durable scoped UUID keys; patch/post parent If-Match;
  create 201/Location/ETag, detail/patch/post ETag; bodyless post.
- Filters, sorts, numeric strings and status/error inventory follow canonical OpenAPI.
- No deployed snapshot edits. New schema revision only after a concrete reproduction.
