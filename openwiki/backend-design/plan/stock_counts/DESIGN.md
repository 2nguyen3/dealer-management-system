# M22 design and confirmed test seams

StockCountRepository owns bound SQL for count projection, observation and writes;
StockCountService owns authorization, aggregate ETags, commands and transaction.
StockCount/StockCountLine schemas project exact strings; observedLastEntryId is private.
Use immutable product/unit IDs and current labels (schema stores no count label snapshot).

Lock rule/products/units → sorted inventory balances → count header. Rediscover IDs
after header lock; retry changed dependency discovery. Every writer locks parent,
compares complete count including lines and private snapshot identity in ETag, and
rechecks live grants after waits. Fresh recount capture never reuses old observations.
Confirm: compare quantity+entry identity, create neutral M21 draft for nonzero lines,
set count CONFIRMED/link BEFORE adjustment movement, then M21 post_internal. SQL's
deferred count reconciliation validates the final posted adjustment. Force all
constraints before response; one caller-owned command/commit, no nested HTTP.

Confirmed seams: actual TestClient/source-schema assertions, real Session services,
existing isolated Supabase fixture and independent ordered_race, fresh-connection
state checks; inject posting/finalization failure to prove entire count rollback.
