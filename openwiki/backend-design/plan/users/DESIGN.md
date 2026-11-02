# Design — M04

Reuse AppUser, UserGroup, AuthToken and auth's UserResponse/to_user_response.
UserRepository owns joined query, fresh FOR UPDATE user lookup, group FOR SHARE
lookup and insert/update. It never commits. UserAdministrationService owns
get/list/create/update/reset_password and transaction finalization. Router delegates.
Dependencies reload current actor/grants inside the write, using users.manage.

Lock target user before tokens (same as auth). Lock current/destination groups in
ID order FOR SHARE, serializing joined-label ETags with group renames. Reauthorize
after user/group waits, before comparing ETags or mutating. Group FK protects an
assignment against M03 deletion; do not take a conflicting exclusive group lock
before target user. Hash before writing, flush authVersion trigger, invalidate all
REFRESH/PASSWORD_RESET rows only for actual group/status changes or reset. Force
deferred constraints, validate detached public projection, commit before success.
Rollback on all exceptions; translate only known duplicate/FK/lock conflicts safely.

List filters q/fullName/email literal search, groupId/status, source sorts with id
tie-breaker. Signed query-scoped anchor-v2 cursor stores anchor ID plus a fixed-size
digest of original sort fields. Resolve the anchor within the original filters;
deleted/mismatched/moved sort anchors reject with INVALID_CURSOR rather than
silently skipping unchanged records. This avoids unbounded text tokens.
Use BusinessRoute and M02 safe schemas/headers. No schema migration expected.
