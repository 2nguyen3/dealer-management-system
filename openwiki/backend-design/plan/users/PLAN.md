# M04 — users

Prepared 2026-10-04 **before implementation**. Prerequisite: verified M03; reuse
M01 identity, hashing, live authorization and user-before-token lock protocol.

Own all five source operations: listUsers, getUser, createUser, updateUser,
resetUserPassword. No delete, implicit unlocking, token issuance or password patch.
The authority is [target OpenAPI](../../API/openapi.json), BM11/QĐ11/QĐ13/QĐ14,
reviewed 0001/0003 DDL and [M04 work package](../full_backend/MODULES.md#m04--users).

Phases: schemas and safe projections; repository/query/locking; atomic writes and
HTTP; offline contract tests; isolated PG state/rollback and auth/group races;
100% owned statement/branch coverage; evidence and availability handoff.
See REQUIREMENTS, DESIGN, TESTS, CHECKLIST and VERIFICATION in this folder.
