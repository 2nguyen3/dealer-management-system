# Tests — M09

Gate: 100% owned/new shared statement/branch coverage; no required skips/xfails.

| Responsibility/symbol family | Success | Failure | Boundary |
| --- | --- | --- | --- |
| UnitCreate/Update/Response; MasterUpdate validator | exact/default policy | null/coercion/empty/extra | integer vs fractional quantities |
| UnitRepository.query/lock/references/validate_update | unused toggle/count/read | used policy/delete/missing | same-value, draft/posted/canceled/count refs |
| CatalogueService CRUD/list/etag/write | committed rows/audit/pages | stale/duplicate/commit rollback | six sorts/filter false/literal wildcards/long text |
| get_unit_service/authorize; five explicit handlers | permitted exact source contract | 401/403/media/redacted validation | permission alternatives, If-Match/204/Location |

PG independent product/line/count assignment vs deletion/fraction update and
receipt posting vs inactivation/policy tests; existing seeded history snapshots
unchanged. Exact callable/test-node and coverage evidence recorded before closure.

## Actual callable register

All inherited/shared symbols and nested closures are listed in the [M04 shared
register](../users/TESTS.md#actual-callable-register-completed-implementation), using `[units]`
parameters. Unit DTOs additionally use `tests/catalogues/test_schemas.py::test_fraction_is_strict_boolean`,
`test_master_unit_defaults_exact_money_and_password_boundaries` and all patch cases.

| Exact owned symbol | Requirement / exact nodes under tests/integration/catalogues |
| --- | --- |
| `UnitRepository.query`, `create` | N01/N06/N07; `test_contract.py::test_five_operations_exact_contract_and_mutations` (both fraction filters), `test_runtime_matches_every_source_schema_parameter_response_header`; `test_state.py::test_all_sorts_filters_cursor_and_duplicate_boundaries`, `test_persisted_and_definite_rollback_every_mutation` |
| `UnitRepository.recorded`, `references`, `validate_update` | N03–N07; `test_state.py::test_unit_all_recorded_reference_and_fraction_guards` (product/draft/posted/cancelled/count), `test_unit_historical_only_reference_still_blocks_delete`, `test_inactive_and_integer_fraction_receipt_rejection`; `test_races.py::test_unit_first_recording_or_post_vs_fraction_policy`, `test_catalogue_reference_creation_vs_delete`; seeded-history node |
| `get_unit_service` | N02; `test_contract.py::test_current_permission_admission_recheck_and_each_read_alternative`; `test_lock_permissions.py::test_revoked_grant_during_real_target_lock_wait` |
| `list_units`, `get_unit`, `create_unit`, `update_unit`, `delete_unit` | N01–N07; all five `test_contract.py` nodes and state/races above; `tests/deployment/test_01_catalogues_smoke.py::test_users_and_catalogues_direct_and_nginx[units-*]` |
| `alembic.versions.0005_unit_policy.upgrade`, `downgrade`; SQL `dms.lock_recorded_unit_policy`, `dms.guard_recorded_unit_policy`, three `a0_*` trigger bindings | N03/N04/N05; `test_history.py::test_fresh_populated_upgrade_seed_repeat_and_catalogue_history`, `test_migration_direct_database_recorded_policy_guard`; both winner orders in `test_races.py::test_unit_first_recording_or_post_vs_fraction_policy`; retained seed/regression/mapping tests |

Owned Python symbols are in `app.modules.units.{repository,dependencies,router}`;
the migration is verified with real SQL state/races, not mocked call counts. 0005
adds no columns/tables and leaves initial snapshots unchanged. No deferred operation
remains; exact statement/branch and database evidence is in VERIFICATION.
