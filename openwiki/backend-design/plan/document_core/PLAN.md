# M13 — Document core

Prepared 2026-10-05 before implementation. Prerequisites: verified M11/M12 at
head0006. Delivery packet E07; this is an internal shared slice, not M28 closure.

## Scope and phases

1. Map existing SQL-owned document/revision/line/batch tables using typed SQLAlchemy
   Core projections, consistent with products/agencies. Register the module in
   Alembic; retain reviewed SQL ownership and existing metadata drift protection.
2. Exact all-seven-kind detail/revision/line readers, summary and mutation DTOs,
   historical snapshots and kind permission dispatch.
3. Parent-serialized current-DRAFT line create/replace/delete, exact totals,
   generated line numbers, revision construction and parent ETags.
4. Append-only batch/reversal primitives composed in caller-owned transactions.
5. Receipt validator integration in M15 and retained seeded-kind read regression.

M13 supplies foundations for listDocumentRevisions/getDocumentRevision/
listDocumentLines/getDocumentLine/createDocumentLine/replaceDocumentLine/
deleteDocumentLine. Their public full-operation gate remains M28. No generic
posting or physical document deletion API is added. Other goods-kind writers
register their validators in their owning slices.

See [requirements](REQUIREMENTS.md), [design](DESIGN.md), [tests](TESTS.md),
[checklist](CHECKLIST.md) and [evidence](VERIFICATION.md).
