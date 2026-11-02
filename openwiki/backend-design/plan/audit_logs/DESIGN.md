# Design

Read-only SQLAlchemy table clause describes immutable audit_log; no ORM duplicate
or migration is needed. AuditRepository casts JSONB to text, then projection uses
json.loads(parse_float=Decimal) so no fractional/large JSON value loses precision.
Only schema-owned top-level identifiers/numerics are converted to exact strings;
catalogue IDs remain integers. Arbitrary nested note values retain their types.
All BIGINT actor columns are registered explicitly. sensitive_key normalizes
provider naming variants; public_json recursively removes credentials. exact_json
emits arbitrary Decimal notes as exact JSON number text, so routes return the
validated typed projection with Response without float or unrelated numeric-string
conversion. Source response schemas still describe the published contract.
AuditService reuses signed filter-bound CatalogueService keysets, full sort anchor
validation and strict created-time range validation. No commits on reads.
