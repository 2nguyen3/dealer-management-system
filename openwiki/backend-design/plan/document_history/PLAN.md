# M28 — document history and snapshot printing

Prepared before M28 code. Reuse M13 seven-kind DocumentService, M22 confirmed-count
protection, M23 cumulative-return lineage, M25 credit and M27 paid-refund invariants.
M26/M27 provider acceptance remains blocked; M28 implementation may be independently
tested but publication must preserve the owning prerequisite gates.

Deliver all nine canonical Document History operations: search, revisions/list/detail,
goods-line list/detail/create/replace/delete, and print. Canonical paths, schemas,
permissions and headers remain in `../../API/openapi.json`. No posted correction or
public cancellation is included; these stay M29.

Phases: permission-scoped readers/cursors; all four draft-line dispatchers; detached
snapshot HTML/PDF rendering/font; owning real-PG state/rollback/lock tests; source
contract and per-file100% coverage; separate reviews; built-image/direct/proxy probes.
