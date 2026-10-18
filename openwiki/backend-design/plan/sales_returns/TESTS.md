# M23 test register and exact gate

Additional registered nodes:
`test_http.py::test_return_http_headers_filters_media_and_durable_post` verifies actual
list/header/date/ETag/key/media and forbidden client-price behavior;
`test_unchanged_rounding.py::test_chronological_returns_do_not_replace_unchanged_frozen_content`
preserves an unchanged dependent revision;
`test_credit_sources.py::test_credit_funded_sale_return_restores_original_cash_source_without_new_cash`
posts a return after a persisted CREDIT_APPLICATION, with inactive/renamed product/unit
and terminated agency, preserving original snapshots and receipt provenance.

Owning scope app.modules.sales_returns and the new
`alembic/versions/0007_return_lot_successors.py`, plus changed shared production, EACH file
100% statements/branches with zero exclusions. Actual symbols/nodes registered during
implementation. Required: five HTTP contracts/all permissions/keys/media/ETags;
origin wrong-kind/state/line ownership/current price conflicts; no client prices;
fractions/cap/two returns last quantity;0.5+0.5 at1VND→1+0 and stock for both;
unpaid/partial/fully paid debt-credit split; original multi-receipt provenance;
backdated insertion changes later rounding via new immutable revisions; repeated
credit-funded sale returns; active/consumed reserves/paid sources; inactive product,
unit and terminated agency historical snapshot reproduction; persisted full rollback
after every appended/replaced leg and command finalization; valid seeded later kinds.
Use SUPABASE_TEST_SCHEMAS=1, independent connections and checkpointed node outcomes.

## Actual-symbol register

| Actual symbols | Concrete nodes / assertions |
| --- | --- |
| `schemas.ReturnLineInput`, `SalesReturnCreate`; `rounding.cumulative_amounts` | `tests/sales_returns/test_rounding.py::test_whole_vnd_cumulative_rounding_preserves_zero_increment`; five parameterized `test_return_source_and_cap_failures` cases; five canonical source contract cases in `test_contract.py`. |
| `SalesReturnRepository.origin`, `origin_line`, `history`, `agency_products` | `tests/integration/sales_returns/test_guards.py::test_return_source_guards_draft_cancel_rollback_and_stock_range`: missing/wrong-kind/pending sources, wrong line, date/cap/fraction/duplicate/current-source mismatch; lifecycle chronological order. |
| `SalesReturnService.lock_origin`, `check_return_date`, `prepare_lines` | Source guard node, dependency-discovery restart; original price/unit/name snapshots; independent arithmetic examples, no replacement client price. |
| `SalesReturnService.create`, `create.<locals>.work`, `lock_draft`, `update`, `update.<locals>.work`, `cancel_draft`, `cancel_draft.<locals>.work` | Guard neutral drafts/empty post/header date/note, internal cancellation/frozen state; `test_return_reduces_only_origin_debt_and_preserves_prices`: real HTTP 204-VND split and stock98. |
| `SalesReturnService.post_revision`, `replace_rounding`, `post`, `post.<locals>.work` | `test_backdated_return_replaces_frozen_rounding_without_mutation`: successor1→0 and original immutable; protected regression reserved/paid cases; guard mid-append rollback and exact stock-overflow409. |
| `dependencies.get_sales_return_service`; router `list_sales_returns`, `get_sales_return`, `create_sales_return`, `update_sales_return`, `post_sales_return` | Five source contracts, actual create/get/post and guard service/header paths; actual false-grant HTTP matrix from M21. Owning HTTP header/list coverage still must be evidenced. |
| Changed `SettlementRepository.lots`, `events` | `test_protected_rounding.py::test_protected_rounding_reproduction[reserved]` / `[paid]`: successor preserves original lot and receipt with reserve/consumed payout. Retained M16 repository files require their full registered regression scope. |
| Revision `0007_return_lot_successors.upgrade`, `downgrade` | `test_migration.py::test_populated_0006_successor_guard_upgrade_seed_and_downgrade`: source0006 seed, immutable content/lots, fresh/populated0007, repeat seed/54checks/down/up. |

`test_races.py::test_two_returns_compete_for_remaining_original_quantity` observes
independent blocking, one2-unit return and second cap rejection, stock99/debt102.
0006 defect reproduction is historical evidence, not a current passing promised branch.
