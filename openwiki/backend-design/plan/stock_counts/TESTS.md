# M22 actual-symbol register and required gate

Additional actual HTTP node:
M21's `test_fractions.py::test_fractional_adjustments_and_count_never_create_a_purchase_price`
also confirms a real0.001 difference for an allowsFraction unit without establishing a price.
`test_http.py::test_count_http_detail_and_durable_zero_confirmation` exercises detail
GET/parent ETag and same-key zero-only confirmation; client snapshot input422,
missing count404 and DELETE405. M21's real AuthService lock-wait nodes also revoke
conditional stock.adjustment.post during count confirmation.

Scope app.modules.stock_counts and changed shared production; exact100% statements
and branches in EACH file, zero exclusions. Register exact nodes as code is introduced.
Required behaviors: all ten contracts/headers/methods/media/auth; complete child ETag;
missing/cross-parent IDs; duplicate/fraction/zero lines; header preserves snapshot;
line patch preserves snapshot; all-product recount rejects omitted/extra/duplicates;
away/back same stock stale; fresh recount succeeds; conditional permission denial;
zero-only confirm/no adjustment; nonzero signed adjustment/no financial effects;
confirmed evidence/linked adjustment immutable; keyed retries and changed payload;
mid-post/deferred/commit rollback; movement vs confirm both lock orders; concurrent
parent edits and same-key confirm. Retain M21 and inventory regressions.

All real DB tests explicitly use SUPABASE_TEST_SCHEMAS=1; no live dms fixtures.

## Actual-symbol register

Integration nodes below live under `backend/tests/integration/stock_counts/`.

| Actual symbols | Success/failure/boundary nodes |
| --- | --- |
| `schemas.CountLineInput`, `StockCountCreate`, `StockCountUpdate`, `CountLineUpdate`, `StockRecount`, `StockCountLine`, `StockCount`, `StockCountList`, `CountLineList` | `tests/stock_counts/test_contract.py::test_count_contract` (all ten source methods/bodies/statuses/headers); lifecycle validates actual StockCount/StockCountLine JSON and zero quantities. |
| `StockCountRepository.__init__`, `header`, `lines`, `product_ids`, `observation` | All lifecycle nodes; `test_guards.py::test_count_failure_boundaries_and_atomic_confirmation_rollback`: missing parent/line; `test_same_quantity_movement_is_stale_until_fresh_recount`: unchanged quantity but changed identity. |
| `StockCountRepository.create`, `update`, `put_line`, `listing` | `test_count_line_edits_and_parent_tokens_preserve_observations` header/create-line/line patch; recount node refreshes snapshot; guard checks exact-set rejection, all time/id sort pages and date boundaries. |
| `StockCountService.project_line`, `get`, `etag`, `get_line`, `result` | Three lifecycle nodes; guards missing/cross-parent line, complete parent token, Location201 and private observation identity. |
| `StockCountService.command`, `command.<locals>.authorize`, `validate_quantity`, `lock` | Guards duplicate/fraction/dependency-discovery/missing conditional grant; false-grant HTTP matrix is in M21; post-wait permission checks remain mandatory. |
| `StockCountService.create`, `create.<locals>.work`, `update`, `update.<locals>.work`, `create_line`, `create_line.<locals>.work`, `update_line`, `update_line.<locals>.work` | Header/line lifecycle and guard duplicate/fraction/confirmed rejection; line PATCH returns its body and parent ETag from the same locked transaction (review fix). |
| `StockCountService.recount`, `recount.<locals>.work` | Fresh-recount lifecycle plus guard omitted/extra/duplicate product set. |
| `StockCountService.confirm`, `confirm.<locals>.work` | Nonzero linked adjustment; all-zero no empty adjustment; stale movement; missing reason/conditional grant/empty count; injected post failure leaves count DRAFT/link null/no adjustment/stock100. |
| `StockCountService.list`, `lines` | Lifecycle plus guard all four header sorts/keysets, line sort/filter/cursor, empty/malformed intervals and source scope. |
| Dependency `get_stock_count_service`; router `list_stock_counts`, `create_stock_count`, `get_stock_count`, `update_stock_count`, `list_stock_count_lines`, `create_stock_count_line`, `get_stock_count_line`, `update_stock_count_line`, `recount_stock`, `confirm_stock_count` | Ten canonical contracts and real HTTP lifecycle; new-operation false-grant matrix. |

`test_races.py::test_count_confirm_and_stock_movement_both_winners[count]` and
`[movement]` prove observed real PG blocking and either valid confirmed evidence or
STALE_STOCK_SNAPSHOT, with final stock101. Final source/coverage/review gate passes
with the linked VERIFICATION evidence.
