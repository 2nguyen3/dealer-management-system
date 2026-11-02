# Design and reviewed D02 repair

SQLAlchemy typed table clauses describe SQL-owned product/cache/source projections;
repositories never commit. ProductRepository owns SELECT joins/price-source mapping,
FOR UPDATE owner and FOR SHARE unit/rule locks, existence/reference/state guards.
Full response ETag includes joined labels/current price/stock/source, not only row
timestamp. Preserve numeric sort and signed filter-bound cursor anchors.

Reviewed additive 0006: owner BEFORE DELETE guard locks cache and rejects references
or nonzero/source state; cache owner FK changes RESTRICT→CASCADE. protect_balance
allows DELETE only at nested trigger depth, absent parent and exactly zero cache;
direct DELETE/UPDATE remains denied, existing deferred nested UPDATE retained.
Real cascade ordering is verified, not assumed. All other FKs remain RESTRICT.
Strengthen product unit policy to include any line/count use and lock product FOR
SHARE before first line/count validation; this closes first-use/unit-change races.
Downgrade restores original FK/protection and removes only added guards.
The coordinated revision0006 also supplies M12 agency-history date locks/validation.
No deployed SQL snapshot was edited. Product create reauthorizes after its unit
lock wait; SQL-owned typed table clauses do not add autogeneration mappings.
