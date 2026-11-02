# M03 — User groups

**Started:** 2026-10-03. **Prerequisite:** verified M02 shared API foundations.
**Status:** locally verified; all five target operations published, no deferred branches.
Exact results are in [VERIFICATION](VERIFICATION.md).

Read REQUIREMENTS, DESIGN, TESTS, CHECKLIST and VERIFICATION in this folder.
Source: [OpenAPI](../../API/openapi.json), [M03 work package](../full_backend/MODULES.md).
M04 users now reruns assignment/deletion with its real create/update writer in both
orders; [passing evidence](../users/VERIFICATION.md). Next slice is M05 permissions.

1. P0: source operation/permission/schema and populated-reference inspection.
2. P1: strict create/PATCH/list DTOs, existing ORM queries, counts, signed keysets.
3. P2: group-locked mutations, complete-detail ETags, audited grant cleanup and rollback.
4. P3: publish all five thin authorized routes with exact statuses/headers/media.
5. P4: real PostgreSQL state/race/HTTP/contract and strict scoped coverage evidence.

Complete only after all source operations, actual custom callables and mandatory
tests pass. New groups start with no grants. Both ACTIVE and LOCKED users block
deletion; no fabricated system-group rule is added.
