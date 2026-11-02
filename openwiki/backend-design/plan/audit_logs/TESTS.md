# Symbol register and verification gates

Scope app.modules.audit_logs: exact 100% statement/branch coverage.

| Actual symbols | Success | Failure/boundary |
| --- | --- | --- |
| project_snapshot, AuditResponse.project | exact IDs/money/quantity/rate, nulls, notes | credential sentinels, large/fractional numeric values, catalogue IDs |
| AuditRepository.query; AuditService.list inherited get/list | all combined filters, tied timestamps, empty pages | invalid half-open interval/cursor, unknown ID |
| get_audit_service; list_audit_logs/get_audit_log | source response/policy/filter contract | unauthenticated/false/missing grants, invalid path/time |

Real PG: committed M05 audit actor/function/request and before/after; rollback
leaves no audit; UPDATE/DELETE audit denied. Concurrent append across keyset pages
must not duplicate an already consumed immutable timestamp/ID boundary.

## Completed actual symbols → executed nodes

| Actual callable (app.modules.audit_logs) | Passing nodes |
| --- | --- |
| schemas.sensitive_key, exact_json, public_json, project_snapshot, AuditResponse.project | test_audit.py::test_exact_projection; test_nested_number_precision_actor_keys_and_provider_redaction; test_exact_nested_json_over_real_http; test_read_filters_ties_immutable_and_authorization |
| repository.AuditRepository.query; service.AuditService.list | test_read_filters_ties_immutable_and_authorization (all four sorts/ties/filters/interval boundaries); test_concurrent_append_does_not_repeat_consumed_keyset |
| dependencies.get_audit_service; router.list_audit_logs, get_audit_log | preceding HTTP nodes; master_data/test_contract.py::test_all_new_operations_exact_runtime_contract; master_data/test_authorization.py (both audit operation variants); deployment/test_02_master_data_smoke.py |

AuditResponse/AuditListResponse and inherited CatalogueService get/list/cursor
mechanics retain shared exact-schema/error/rollback evidence. M05's rollback
node proves audit absence; database deny_change is exercised on UPDATE/DELETE.
Final per-file100% scope and exact commands: [VERIFICATION](VERIFICATION.md).
