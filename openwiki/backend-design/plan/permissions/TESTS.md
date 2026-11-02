# Actual-symbol and gate register

Scope: app.modules.permissions, 100% statements and branches; also preserve shared
and authentication scope. Required integration selection must fail without the
explicit guarded BUSINESS_TEST_DATABASE_URL, never fall back to runtime DB_*.

| Symbols | Success | Failure/boundary |
| --- | --- | --- |
| FunctionRepository's inherited CatalogueRepository.query; FunctionService inherited get/list/etag | all 33, literal search, both-direction pages | missing ID, bad cursor/sort, tied names |
| PermissionRepository.query/require_group | joined exact IDs/labels, false filter | unknown group, empty list, filter mismatch |
| PermissionService.list/get_pair/set | absent→true→false persisted, audit correlation | missing parent/function/grant, malformed/stale/create preconditions, rollback |
| get_function_service/get_permission_service and all five router functions | source schemas/statuses/headers/policies | anonymous/denied/false/missing grants, transport validation |

Independent connections: two absent-pair creators (one 201, one 412), two updates
with same ETag (one winner), owner deletion vs grant set, revocation while writer
waits. Reuse the same access token to prove next-request authorization and no
MANAGEMENT bypass. Verify no committed grant/audit on forced failure.

## Completed actual symbols → executed nodes

All names below are under app.modules.permissions unless qualified otherwise.

| Actual callable | Passing success/failure/boundary/state/race nodes |
| --- | --- |
| dependencies.get_function_service, dependencies.get_permission_service | master_data/test_contract.py::test_all_new_operations_exact_runtime_contract; master_data/test_authorization.py::test_every_new_operation_missing_false_and_anonymous_denial; permissions/test_permissions.py::test_registry_and_grants_contract |
| repository.PermissionRepository.query, require_group; FunctionRepository's inherited CatalogueRepository.query | test_registry_and_grants_contract (all filters/sorts/ties/missing); test_rollback_and_pair_races; test_owning_group_deletion_and_grant_write_both_orders |
| service.PermissionService.list, get_pair, set and set's work closure | test_registry_and_grants_contract; test_next_request_no_management_bypass; test_rollback_and_pair_races; test_set_waits_for_deleted_owner; test_owning_group_deletion_and_grant_write_both_orders; master_data/test_lock_authorization.py (permissions variant) |
| router.list_functions, get_function, list_group_permissions, get_group_permission, set_group_permission | registry/grant contract node, all-operation contract/auth nodes and deployment/test_02_master_data_smoke.py |

DTO classes FunctionResponse/FunctionListResponse/PermissionSet/PermissionResponse/
PermissionListResponse reuse the tested shared/auth exact types; inherited
CatalogueService read/cursor/ETag/write symbols remain registered in shared_api.
Final scope/commands and closure evidence: [VERIFICATION](VERIFICATION.md).
