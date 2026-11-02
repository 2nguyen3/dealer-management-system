# Actual symbols and gates

Scope app.modules.products: 100% statements/branches; preserve shared/auth scope.

| Symbols | Success | Failure/boundary |
| --- | --- | --- |
| ProductRepository.query/lock/unit/recorded/references/validate_update; inherited SqlCatalogueRepository create/update/delete | zero initial cache, source joins, duplicate names | inactive/missing unit, recorded unit, references |
| ProductService.list and inherited writes/get/etag | exact range/sort, strict threshold, D16 >Money/zero | bad range/stale cursor/ETag, no client balances/code/price |
| schemas, get_product_service, five routes | source contract/policies/headers | anonymous/false/missing grants, malformed transport/IDs |

Real PG: D02 0005 failure then 0006 eligible delete/audit/rollback; cache direct
mutations rejected; used zero-net/history/count owners retained; no identity reuse.
Independent connections: first use vs delete/unit change, unit inactivation vs
assignment, rule/source changes vs detail preconditions. Near-limit receipt/rate
and rounded-zero quotes must remain readable; historical snapshots unchanged.
Migration fresh/populated upgrade/downgrade/re-upgrade and seed twice/54 checks.

## Completed actual symbols → executed nodes

| Actual callable | Passing nodes |
| --- | --- |
| products.repository.ProductRepository.query, lock, unit, recorded, references, validate_update | master_data/test_state.py::test_product_unit_threshold_ranges_price_source_and_d16; test_recorded_count_product_and_direct_cache_denial; master_data/test_contract.py::test_crud_state_contract_errors_and_rollback[products] |
| products.service.ProductService.list, create and create work closure | preceding nodes; master_data/test_races.py::test_product_first_use_against_unit_change_and_delete; test_actual_assignment_vs_master_inactivation_both_orders; test_lock_authorization.py product_create/product_update |
| common.sql_catalogue.SqlCatalogueRepository.create, lock, update, delete (inherited DML) | CRUD missing/present/rollback/node above for both products and agencies; real mutation/reference races |
| products.dependencies.get_product_service; router.list_products, get_product, create_product, update_product, delete_product | exact full-operation contract/auth nodes, CRUD/range/transport/state tests, deployment/test_02_master_data_smoke.py |
| 0006 revision.upgrade, downgrade; SQL guard_eligible_owner_deletion, protect_balance, lock_recorded_product_policy, guard_recorded_product_policy | master_data/test_migration.py (both nodes); draft/count/posted/canceled state nodes; first-use/delete races |

ProductCreate/ProductUpdate/ProductResponse/ProductListResponse/PriceSource reuse
shared exact/schema/patch validators. Inherited read/ETag/write/cursor helpers have
success/failure/boundary tests in the shared register and combined100% scope.
Final commands and owned scope: [VERIFICATION](VERIFICATION.md).
