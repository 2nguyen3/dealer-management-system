# Actual symbols and gates

Scope app.modules.agencies: exact 100% statements/branches and prerequisite regression.

| Symbols | Success | Failure/boundary |
| --- | --- | --- |
| AgencyRepository.query/prepare_create/lock/masters/capacity/validate_update/references; inherited SqlCatalogueRepository create/update/delete | zero caches, type/district/contact updates | missing/inactive masters, cap/type-debt/history blockers |
| AgencyService.list/create/terminate and inherited writes | filter/sort/debt/date ranges, keyed debt-preserving termination | invalid ranges, stale ETag, duplicate/conflicting keys, rollback |
| schemas, dependency, six routes | exact source schemas/policies/headers | anonymous/false/missing grants, code/status/balance injection |

Real PG independent connections: last-slot creates, opposing moves, admission vs
rule lowering, type limit lowering vs type move, termination vs posting, reference
creation vs delete. Assert persisted state/rollback/audit, historical acceptedDate
and used zero-cache deletion rejection, monotonic codes, same-key exactly once.
Shared 0006 upgrade/downgrade/seed/SQL gates are required, not inferred from HTTP.

## Completed actual symbols → executed nodes

| Actual callable | Passing nodes |
| --- | --- |
| agencies.repository.AgencyRepository.query, masters, lock, capacity, prepare_create, validate_update, references | master_data/test_state.py::test_agency_master_capacity_contact_history_type_debt_and_termination; test_contract.py::test_crud_state_contract_errors_and_rollback[agencies]; reference/state races |
| agencies.service.AgencyService.list, create, validate_update, terminate and nested write/authorize/project closures | preceding nodes; test_contract.py::test_termination_key_replay_state_and_rollback; test_races.py last-slot/opposing-move/type/termination nodes; test_review_regressions.py (both history orders and claim-wait replay revocation) |
| agencies.dependencies.get_agency_service; router.list_agencies, get_agency, create_agency, update_agency, delete_agency, terminate_agency | exact20-operation schema/status/header/policy comparison; every-operation auth nodes; all seven lock-wait writer variants; deployment/test_02_master_data_smoke.py |
| common.sql_catalogue.SqlCatalogueRepository.create/lock/update/delete; core.transactions.TransactionRunner.run (post-claim authorization) | CRUD persisted/rollback nodes; same-key concurrency/replay revocation; shared_api protocol/command regression |
| SQL lock_document_agency_history, guard_agency_history_date; shared0006 owner/cache guards and revision upgrade/downgrade | test_review_regressions.py::test_acceptance_date_vs_existing_draft_history_both_orders; test_reference_races.py both orders; test_migration.py both nodes |

AgencyCreate/AgencyUpdate/Reason/AgencyResponse/AgencyListResponse reuse shared
PatchModel, dates/IDs/money and EmailRequest.valid_email; source schemas and invalid
null/extra/status/code/balance input boundaries pass. Final100% scope, commands and
prerequisite regressions: [VERIFICATION](VERIFICATION.md).
