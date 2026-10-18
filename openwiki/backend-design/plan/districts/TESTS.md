# Tests — M07

Gate: 100% owned/new shared statements and branches; no required skips/xfails.

| Actual responsibility/symbol family | Success | Failure | Boundary |
| --- | --- | --- | --- |
| MasterCreate/MasterUpdate.nonempty_patch, DistrictResponse | valid projection | null/extra/empty patch | whitespace, IDs, defaults |
| DistrictRepository.query/lock/references | counts/global rule/caller-owned CRUD | missing/referenced/duplicate | terminated counts, rule/ETag changes |
| CatalogueService.__init__/get/list/etag/write/create/update/delete | exact pages/committed audit | missing/bad cursor/stale/commit rollback | six sorts, literal wildcards/long text/no-op |
| get_district_service/authorize; five explicit handlers | live authorized contract | 401/403/media/validation | anyOf reads, headers/status/preconditions |

PG: all mutation failure points leave row/audit unchanged; reference checks use
seeded history; independent rule/admission/inactivation/delete and stale-writer
races prove serialized state/capacity. Final exact callable/node register and
coverage totals go in VERIFICATION before closure.

## Actual callable register

Shared constructors/query/lock/CRUD/transaction/pagination/ETag/validator/maker/
authorization/header symbols and nested closures are all enumerated with exact
nodes in [M04 shared register](../users/TESTS.md#actual-callable-register-completed-implementation).
Use their `[districts]` parameters here. District DTOs inherit Master models;
`tests/catalogues/test_schemas.py` checks their defaults/null/extra/empty boundaries.

| Exact owned symbol | Requirement / exact nodes under tests/integration/catalogues |
| --- | --- |
| `DistrictRepository.query` | D03; `test_state.py::test_master_derived_counts_terminated_references_inactive`, `test_full_district_capacity_is_global_and_fifth_admission_rolls_back`; list/sort/cursor and missing-detail contract nodes |
| `DistrictRepository.lock`, `references` | D04/D05/D06; `test_races.py::test_district_admission_vs_inactivation`, `test_catalogue_reference_creation_vs_delete`, `test_competing_etag_writers_one_winner`; `test_history.py::test_fresh_populated_upgrade_seed_repeat_and_catalogue_history` |
| `DistrictRepository.validate_update` | D04; same admission race and inactive/active-reference state node; profile/no-op mutation contract and rollback nodes |
| `get_district_service` | D02; `test_contract.py::test_current_permission_admission_recheck_and_each_read_alternative`; `test_lock_permissions.py::test_revoked_grant_during_real_target_lock_wait` (both unchanged/stale target branches) |
| `list_districts`, `get_district`, `create_district`, `update_district`, `delete_district` | D01–D06; all five `test_contract.py` nodes, real target-wait revocation; `tests/deployment/test_01_catalogues_smoke.py::test_users_and_catalogues_direct_and_nginx[districts-*]` |

All symbols use `app.modules.districts.{repository,dependencies,router}`. No
deferred district operation or dependency remains. Exact coverage/commands: VERIFICATION.
