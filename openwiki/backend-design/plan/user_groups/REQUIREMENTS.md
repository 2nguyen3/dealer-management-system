# M03 requirements

Authority: target `/user-groups` and `/user-groups/{groupId}`, Group/Create/Update
schemas, selected employee/RBAC/audit decisions, immutable 0001 schema.

| ID | Required behavior |
| --- | --- |
| UG01 | listUserGroups/getUserGroup: anyOf groups.manage/users.manage/permissions.manage; ID remains CatalogId integer, count includes LOCKED users, aware timestamps. |
| UG02 | createUserGroup: groups.manage; strict nonblank code/name, existing case-sensitive uniqueness, no implicit permissions; 201 plus Location/ETag. |
| UG03 | updateUserGroup: groups.manage; nonempty PATCH, omitted fields preserved, explicit null/extras rejected; missing428, stale412/current ETag, duplicate409; response reflects committed state. |
| UG04 | deleteUserGroup: groups.manage AND permissions.manage; lock/reload, reject any user, remove grants and group atomically, audited empty204; FK protects concurrent assignments. |
| UG05 | list q/code AND filters, trimmed literal search, source six sort options, same-direction id tie, default25/max100, signed operation/filter/sort-scoped cursors, safe invalid400. |
| UG06 | All mutations use server actor/request/groups.manage context and caller-owned synchronous transaction; deferred checks and typed response before commit; rollback precedes safe DB translation. |
| UG07 | Health/auth privacy/current grants remain valid; no source request requires an idempotency key for these five operations. |
