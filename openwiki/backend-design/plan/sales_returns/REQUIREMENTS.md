# M23 requirements

Q03/Q05/Q08–Q10/Q15, D06/D08/D15/D17 and canonical Sales Returns operations apply.
Reads any returns.prepare/returns.post/debt.read/sales.read; create/patch prepare,
post returns.post, internal draft cancel documents.cancel. Parent ETags and durable
create/post/cancel command keys use existing transport. Bodyless post,201 Location.

Origin must be POSTED STOCK_ISSUE; derive immutable agency. Lines reference a posted
revision of that issue, current product/unit/price must still agree with original
sale. Preserve original names/unit/price provenance; reject client price/product.
Return date >= sale date; terminated agencies/inactive masters remain valid historical
sources. Cumulative effective returned quantity <= current sold quantity.
Amount per line = HALF_UP(cumulative quantity * original unit price) - prior amounts;
zero increments still post stock and append no zero financial entries.
Reduce only source invoice debt first; remaining amount creates original-receipt
credit. Replay all persisted financial kinds; protect active reserves and paid refund
lot identity/cash origins. New backdated returns may require new dependent revisions;
never mutate frozen posted line/header. Reproduce D15 conflicts before any migration.
