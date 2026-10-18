# Requirements

BM13/QĐ13 and full-backend M05 require current data-driven grants. Reuse the
existing AppFunction/GroupPermission/UserGroup mappings and live AuthService.
Canonical paths/schemas: functions, group permissions, Function, Permission,
PermissionSetRequest. Registry has 33 system functions. Catalogue IDs are integers;
grant BIGINT IDs are strings. List filters/sorts must match the source contract.

PUT requires exactly one precondition: If-None-Match:* for absent records or a
strong If-Match for existing records. Neither => 428, both/malformed => 422,
lost create/stale update => 412 with current ETag when present. False is stored,
not deleted. Successful create returns 201/Location/ETag; update 200/ETag.
BM14 requires atomic actor/function/request-correlated audit, no audit on rollback.
