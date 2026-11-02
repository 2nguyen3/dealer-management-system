# Tests — M04

Gate: **100% statements and branches** for every new users behavioral file and
new shared catalogue helpers. Retain M01–M03 suites. No required skips/xfails.
Actual callable register is finalized alongside implementation below; each route
inherits the service's state cases and adds HTTP authorization/transport boundaries.

| Symbols/responsibility | Success | Failure | Boundary |
| --- | --- | --- | --- |
| request validators; user_etag | valid source models | empty/null/extra/invalid email/ID | one-character/space password, BIGINT bounds, joined-label ETag |
| UserRepository.__init__/query/lock/group/create/update | persisted caller-owned CRUD | missing row/group, uniqueness | rollback, locked group reference |
| UserAdministrationService.__init__/get/list | joined exact projection/pages | 404, invalid cursor/sort | all sorts/filters, ties/literal wildcard, empty/long-text page |
| write/create/update/reset_password | hash/version/revocation/audit persisted | commit/deferred/duplicate/authorization rollback | no-op/profile retains session, reset locked, stale ETag |
| get_user_service/authorize; all five route handlers | live permitted HTTP | 401/403/media/redacted validation | headers/status/schema parity, missing/duplicate If-Match |

Real PG races: CI duplicate email, two ETag writers, M04 create/update vs M03 delete
in both winning orders; refresh/login vs group/status/reset in both serialized
orders, proving any session issued before administration becomes invalid.
Record exact test nodes, coverage totals and commands in VERIFICATION before closure.

## Actual callable register (completed implementation)

Paths below are relative to backend; `C` means `tests/integration/catalogues` and
`S` means `tests/catalogues`. Every listed node's resource parameter includes users
unless its name denotes a catalogue-only guard. Nested work/projection closures
are covered at their owning service boundary. Shared code is owned jointly by these
four slices; other child TESTS link this register rather than duplicating it.

| Exact symbol | Requirement / exact success, failure and boundary nodes |
| --- | --- |
| `app.common.catalogue.PatchModel.nonempty_patch` | U01/U05; `S/test_schemas.py::test_patch_rejects_empty_null_extra_and_bad_status`, `test_master_unit_defaults_exact_money_and_password_boundaries`, `test_user_patch_safe_invalid_inputs` |
| `CatalogueRepository.__init__`, `query`, `lock`, `create`, `update`, `delete` | U03/U07 and D/T/N references; `C/test_state.py::test_repository_is_caller_owned`, `test_persisted_and_definite_rollback_every_mutation`; `C/test_contract.py::test_five_operations_exact_contract_and_mutations`, `test_safe_transport_missing_ids_preconditions`; `C/test_races.py::test_catalogue_reference_creation_vs_delete`, `test_real_m04_assignment_vs_m03_deletion` |
| `CatalogueService.__init__`, `get`, `etag` | U01/U05; `C/test_contract.py::test_five_operations_exact_contract_and_mutations`, `test_safe_transport_missing_ids_preconditions`; `C/test_review_regressions.py::test_joined_group_labels_serialize_user_etags` |
| `CatalogueService.list`, `cursor_boundary`, pagination projection/key closures | U01/U05; `C/test_state.py::test_all_sorts_filters_cursor_and_duplicate_boundaries`, `test_long_text_short_cursor_and_removed_anchor`; `C/test_review_regressions.py::test_mutated_anchor_sort_or_filter_is_rejected` (all four resources) |
| `CatalogueService.write` | U07; `C/test_state.py::test_persisted_and_definite_rollback_every_mutation`, `test_all_sorts_filters_cursor_and_duplicate_boundaries`; `C/test_user_rollback.py::test_failed_admin_write_restores_hash_version_all_tokens_audit`; `C/test_contract.py::test_current_permission_admission_recheck_and_each_read_alternative` |
| `CatalogueService.create`, nested `work`/projection | D/T/N create; `C/test_contract.py::test_five_operations_exact_contract_and_mutations`, `test_current_permission_admission_recheck_and_each_read_alternative`; `C/test_state.py::test_all_sorts_filters_cursor_and_duplicate_boundaries`, `test_persisted_and_definite_rollback_every_mutation` |
| `CatalogueService.validate_update`, `update`, `delete`, nested `work`/projections | D/T/N guards; `C/test_state.py::test_master_derived_counts_terminated_references_inactive`, `test_unit_all_recorded_reference_and_fraction_guards`, `test_persisted_and_definite_rollback_every_mutation`; `C/test_races.py::test_competing_etag_writers_one_winner`; `C/test_lock_permissions.py::test_revoked_grant_during_real_target_lock_wait` |
| `app.common.catalogue_http.make_service`, nested `authorize`, `responses` | U01; `C/test_contract.py::test_runtime_matches_every_source_schema_parameter_response_header`, `test_current_permission_admission_recheck_and_each_read_alternative`, `test_safe_transport_missing_ids_preconditions`; `C/test_lock_permissions.py::test_revoked_grant_during_real_target_lock_wait` |
| `app.modules.users.repository.UserRepository.query`, `group` | U01/U03; `C/test_state.py::test_all_sorts_filters_cursor_and_duplicate_boundaries`, `test_users_group_status_reset_live_effects_and_locked_reset`; `C/test_races.py::test_real_m04_assignment_vs_m03_deletion`; `C/test_review_regressions.py::test_joined_group_labels_serialize_user_etags` |
| `UserAdministrationService.require_group`, `create`, nested `work`/projection | U02/U03/U07; `C/test_state.py::test_users_group_status_reset_live_effects_and_locked_reset`, `test_persisted_and_definite_rollback_every_mutation`; `C/test_races.py::test_case_insensitive_email_creation_race`, `test_real_m04_assignment_vs_m03_deletion` |
| `UserAdministrationService.update`, nested `work`/projection | U04/U05/U07; `C/test_state.py::test_users_group_status_reset_live_effects_and_locked_reset`; `C/test_user_rollback.py::test_failed_admin_write_restores_hash_version_all_tokens_audit`; `C/test_races.py::test_real_administration_vs_auth_both_winners`, `test_competing_etag_writers_one_winner`; `C/test_lock_permissions.py::test_revoked_grant_during_real_target_lock_wait`; joined-group regression above |
| `UserAdministrationService.reset_password`, nested `work`/projection | U04/U05/U06/U07; same invalidation/rollback/auth/group-race nodes, plus `C/test_contract.py::test_five_operations_exact_contract_and_mutations`, `test_safe_transport_missing_ids_preconditions` |
| `app.modules.users.dependencies.get_user_service` | U01/U07; all five contract/permission/lock-wait nodes; shared maker's authorization and rate-limit wiring retain M02 tests |
| `app.modules.users.router.list_users`, `get_user`, `create_user`, `update_user`, `reset_user_password` | U01–U07; all `C/test_contract.py` nodes; `tests/deployment/test_01_catalogues_smoke.py::test_users_and_catalogues_direct_and_nginx[users-*]` |

Request classes reuse M01's email validator and nonempty-password alias; inherited
symbols retain existing auth tests. New user DTOs additionally have every strict,
success/failure/boundary node in `S/test_schemas.py`. Coverage evidence is exact
per-file 100%, not a rounded overall percentage; see VERIFICATION.
