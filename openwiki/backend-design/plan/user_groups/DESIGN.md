# M03 design

Reuse UserGroup from `app.modules.user_groups.models`, AppUser from
`app.modules.users.models` and GroupPermission from `app.modules.auth.models`.
No migration or second ORM mapping. `app.modules.user_groups` owns `service.py`,
strict DTOs in `schemas.py`, five thin BusinessRoute handlers in `router.py`,
session/authorization wiring in `dependencies.py` and persistence in `repository.py`.
GroupRepository never commits/rolls back; GroupService keeps its transaction boundary.

Query Group plus correlated user count in one SQL statement. List fetches limit+1
under an explicit static sort registry and bound escaped search/code predicates.
Cursor scope includes operation, normalized q/code, sort and anchor format. Tokens
carry only the last group ID; the service reloads its current sort values. This
keeps cursors bounded without imposing a business text-length limit. A deleted
anchor returns INVALID_CURSOR so clients restart; mutable sorts across page requests
have no historical snapshot promise. Current authorization
is checked on every route before cursor/replay work. Detail ETag includes every
returned field including userCount and timestamps.

Mutations acquire the target group FOR UPDATE and reload the detail after waiting.
Referenced user inserts/assignments acquire PostgreSQL FK key-share protection:
delete either sees the committed reference or assignment fails after deletion.
M04 must coordinate its group/user/token locks and rerun this opposing race.

Create/update/delete delegates commit ownership to one GroupService write wrapper:
set audit context → domain work → flush/deferred immediate → reload/validate DTO →
commit → route emits success. Reads/repositories/helpers never commit. Known
code/name uniqueness and user-group references map to reviewed safe409; unknown
failures safe500. No blind retry of an uncertain non-keyed creation.

Deletion checks both user statuses, compares the authorized aggregate ETag, then
deletes eligible GroupPermission rows and group under the same transaction/audit
context. Both permission grants are required before the service is called. Writer
callbacks recheck current caller grants after target lock waits, without introducing
a global lock on every acting user for ordinary business requests.
