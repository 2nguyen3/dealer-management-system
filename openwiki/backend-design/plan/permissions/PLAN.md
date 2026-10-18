# M05 permissions

**Current:** full local completion, [passing evidence](VERIFICATION.md).

Prepared 2026-10-04 before implementation. Prerequisites M03/M04 have recorded
passing evidence. Owns listFunctions, getFunction, listGroupPermissions,
getGroupPermission and setGroupPermission in the canonical OpenAPI contract.

Sequence: read-only registry/projections; conditional grant upsert; HTTP wiring;
contract/state/rollback/independent-connection races; exact scoped coverage.
No function CRUD. Missing and false grants both deny. All five operations require
permissions.manage; MANAGEMENT has no bypass. Publication requires all gates in
[CHECKLIST](CHECKLIST.md), with exact evidence in [VERIFICATION](VERIFICATION.md).
