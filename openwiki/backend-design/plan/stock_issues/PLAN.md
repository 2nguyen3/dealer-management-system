# M17 stock issues — core delivery

Active 2026-10-17, requested with M18–M20. Prerequisites M13–M16 are implemented.
Sources: [general plan](../../GENERAL_PLAN.md), [operations](../full_backend/OPERATIONS.md),
[canonical contract](../../API/openapi.json), selected Q02/Q05/Q14/Q15 decisions.

Deliver list/detail/create/header/submit plus internal zero-upfront post, pending
replacement and no-money draft cancellation. M19 completes money posting/replacement;
M29 retains posted correction/full cancellation. Never publish a partial operation.

Order: [requirements](REQUIREMENTS.md) → [design](DESIGN.md) → vertical test/code
slices → [tests](TESTS.md) → [verification](VERIFICATION.md) → [checklist](CHECKLIST.md).
Database tests use explicitly selected isolated Supabase schemas, not Docker PostgreSQL.
