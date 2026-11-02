# M14 tests and actual-symbol register

Confirmed seams: InventoryService and HTTP statement; real PostgreSQL state and
independent writers. **100% statement/branch** scope `app.modules.inventory`.

| Responsibility | Success / failure / boundary |
| --- | --- |
| Statement | reconcile known receipts/issues/reversals; absent product404; empty ledger |
| Event balances | atomic net-zero reversal event; malformed date/sort; same-day different order |
| Filters | half-open/source/effective; cursor filter mismatch400; opening outside page |
| Pagination | ascending/descending multi-page; tampered cursor; limit1/100 |
| Append/reverse | stock preserved; duplicate reversal rollback; fractional unit exactness |
| HTTP | inventory.read granted; false/missing/anonymous denied; canonical schemas/headers |

Tests: `tests/inventory/` and `tests/integration/documents/`. Actual symbols and
exact nodes/results will be registered before closing [CHECKLIST](CHECKLIST.md).

## Actual symbols and passing nodes

Nodes are under `tests/integration/documents/`:

| Actual symbol | Success/failure/boundary evidence |
| --- | --- |
| `InventoryRepository.__init__`, `statement`, `InventoryService.__init__`, `statement` | `test_inventory.py::test_inventory_statement_uses_full_events_before_filters_and_pages`, `test_valid_backdated_receipt_can_make_historical_stock_wider_than_stored_stock`, `test_inventory_requires_exact_read_permission_and_service_sort`; missing404, cursor400, interval/sort422, empty ledger and exact fractions |
| `InventoryRepository.lock_balances`, `append`, `reverse_revision`, `changes` | `test_inventory.py::test_append_reverse_and_atomic_event_balances_preserve_history`; invalid direction/repeated reversal; empty reversal/changes; `test_receipt_races.py` independent post/issue/master/edit races |
| `get_inventory_service`, `list_product_inventory_entries` | all inventory HTTP cases, `test_contract.py::test_inventory_runtime_matches_the_single_canonical_contract`, read-only/anonymous denial and deployment smoke |
| All persisted goods-kind readers | `test_core.py::test_all_seeded_kinds_and_historical_revisions_have_exact_projections`: all24 products, effective/full modes reconcile caches |

Final scope97 statements/14 branches, independently100% in the combined run.
