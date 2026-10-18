# Tests — M08

Gate: 100% owned/new shared statements/branches, no required skips/xfails.

| Responsibility/actual symbol family | Success | Failure | Boundary |
| --- | --- | --- | --- |
| AgencyTypeCreate/Update, Money, MasterUpdate validator | valid maxDebt | number/fraction/overflow/null/empty | zero/maximum exact integer |
| AgencyTypeRepository.query/lock/references/validate_update | counts/limit change | currentDebt blocker, missing/reference | equality/one-over, terminated, unchanged limit |
| CatalogueService CRUD/list/etag/write | committed exact projection/audit | duplicate/stale/commit failure | source sorts/ties/all filters/cursor scope |
| dependency/authorize; five explicit routes | authorized source schemas | missing/false permissions/media | each read alternative, 428/412/422/204 headers |

Real PG state/rollback/seed snapshot and blockers tests; independent issue posting
vs limit lowering, move into type vs lowering, FK delete/assignment and two stale
writers. Final exact node register and coverage totals recorded before closure.

## Actual callable register

Shared inherited symbols and nested closures: [M04 shared register](../users/TESTS.md#actual-callable-register-completed-implementation),
using `[agency-types]` parameters. New request models additionally use
`tests/catalogues/test_schemas.py::test_money_input_is_exact`,
`test_master_unit_defaults_exact_money_and_password_boundaries` and patch boundaries.

| Exact owned symbol | Requirement / exact nodes under tests/integration/catalogues |
| --- | --- |
| `AgencyTypeRepository.query`, `create`, `references` | T01/T05/T06/T07; `test_contract.py::test_five_operations_exact_contract_and_mutations`; `test_state.py::test_all_sorts_filters_cursor_and_duplicate_boundaries`, `test_master_derived_counts_terminated_references_inactive`, `test_persisted_and_definite_rollback_every_mutation`; `test_history.py::test_fresh_populated_upgrade_seed_repeat_and_catalogue_history`; `test_races.py::test_catalogue_reference_creation_vs_delete` |
| `AgencyTypeRepository.lock_balances`, `validate_update` | T03/T04; `test_history.py::test_exact_debt_equality_one_over_terminated_blocker_and_snapshots`; `test_races.py::test_issue_posting_vs_type_limit_lowering`, `test_type_assignment_vs_limit_change`; zero/no-limit/profile update contract cases |
| `AgencyTypeService.validate_update` | T02/T03; above equality/blocker/race nodes; `test_review_regressions.py::test_grant_revoked_while_type_waits_for_balance` proves reauthorization before blocker projection/write |
| `get_agency_type_service` | T02; `test_contract.py::test_current_permission_admission_recheck_and_each_read_alternative`; `test_lock_permissions.py::test_revoked_grant_during_real_target_lock_wait`; balance-wait regression above |
| `list_agency_types`, `get_agency_type`, `create_agency_type`, `update_agency_type`, `delete_agency_type` | T01–T07; all `test_contract.py` nodes; `tests/deployment/test_01_catalogues_smoke.py::test_users_and_catalogues_direct_and_nginx[agency-types-*]` |

All symbols use `app.modules.agency_types.{repository,service,dependencies,router}`.
No deferred operation remains; per-file exact coverage and commands: VERIFICATION.
