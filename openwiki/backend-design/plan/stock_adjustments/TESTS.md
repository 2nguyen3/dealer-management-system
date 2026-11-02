# M21 test register and coverage gate

`test_fractions.py::test_fractional_adjustments_and_count_never_create_a_purchase_price`
adds persisted +1.125/-0.125 adjustments and +0.001 count confirmation on a fractional
unit; unpriced stock stays purchase/selling price0 with no source. Integer-unit -0.5
is rejected409 and recorded fraction meaning cannot subsequently change (23514).

Scope: app.modules.stock_adjustments, plus any changed shared production files.
Every file must have zero missing/excluded statements and missing/partial branches.

Actual symbols will be registered with exact nodes as introduced. Required matrix:
signed positive/negative/zero/fraction; empty/duplicate/missing product; reason;
all reads/filters/keysets; wrong kind/404; stale/missing parent; media/unknown input;
neutral drafts; immutable count-linked document; post/cancel retry/conflict;
past-negative/current-positive rejection; no cash/price-source changes; append and
commit failure rollback; competing negative posts; same-key one effect; grant revoked
while blocked. Preserve relevant receipt/inventory/document regressions.

Commands use SUPABASE_TEST_SCHEMAS=1 and bounded explicit test batches, never live dms fixtures.

## Actual-symbol register

Paths below are relative to backend/. Parameterized nodes retain pytest's emitted IDs
in worker JSON; final gate is not closed merely by this registration.

| Actual symbols | Behavior nodes / required assertions |
| --- | --- |
| `schemas.AdjustmentLineInput`, `StockAdjustmentCreate`, `StockAdjustmentUpdate` | `tests/stock_adjustments/test_contract.py::test_adjustment_contract` (five canonical cases); `test_adjustments.py::test_invalid_history_and_inputs_are_atomic` validates exact nonzero/precision/empty draft; reason/extra fields follow source schema. |
| `StockAdjustmentRepository.query` | `test_adjustments.py::test_signed_stock_only_lifecycle_and_retries`: product-filtered list and scoped continuation across two documents. |
| `StockAdjustmentService.get`, `list` | Lifecycle; `test_guards.py::test_adjustment_guards_and_mid_append_rollback`: wrong kind404. |
| `StockAdjustmentService.independent`, `lock_draft` | Lifecycle stale/frozen tokens; guards wrong kind/dependency discovery; `tests/integration/stock_counts/test_counts.py::test_count_confirm_is_atomic_and_linked_adjustment_immutable`: linked document409. |
| `StockAdjustmentService.create_internal`, `create`, `create.<locals>.work` | Lifecycle positive/negative/neutral draft; guards duplicate products; count confirmation uses same no-commit seam. |
| `StockAdjustmentService.post_internal`, `post`, `post.<locals>.work` | Lifecycle stock97/99, zero price/cash/source unchanged and same-key recovery; invalid-history case rollback; guard empty/missing reason/wrong kind/mid-append failure; `test_competing_negative_posts_preserve_stock` observes independent connection blocking and final stock30. |
| `StockAdjustmentService.cancel_draft`, `cancel_draft.<locals>.work` | Lifecycle internal keyed cancellation; confirmed-count independent mutation remains blocked. |
| `dependencies.get_stock_adjustment_service`; router `list_stock_adjustments`, `get_stock_adjustment`, `create_stock_adjustment`, `update_stock_adjustment_draft`, `post_stock_adjustment` | Actual HTTP lifecycle plus canonical five-operation matrix, missing428/stale412/frozen409; `test_authorization.py::test_new_routes_deny_false_grants_before_resource_access` denies every new operation with real false grants. |

Inherited `StockReceiptService.result/command/update/etag` and shared `DocumentService`
retain their owning registers; no new receipt behavior is claimed by inheritance.
