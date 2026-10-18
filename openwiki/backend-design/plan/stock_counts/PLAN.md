# M22 — stock counts

Prepared 2026-10-17 before code, after M21's stock-posting vertical slice passed real PG.
Dependency M21 final integration/coverage remains required before closing this slice.
Own all ten canonical stock-count operations: list/create/detail/header patch;
line list/create/detail/patch; recount; confirm. No delete operation.

Implement snapshot capture → parent-serialized edits → fresh all-product recount →
atomic conditional adjustment confirmation. Then persisted rollback/races, source
contracts, exact per-file coverage, review and direct/Nginx evidence.

## Verified checkpoint2026-10-18

All ten operations pass17owning cases, real rollback/opposing races and exact6-file
321/56 coverage. M21 prerequisite and direct/Nginx integration pass; see
[VERIFICATION](VERIFICATION.md). No count delete; generic document history stays M28.
