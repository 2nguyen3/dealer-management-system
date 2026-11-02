# M15 tests and actual-symbol register

Confirmed seams: StockReceiptService and five HTTP operations, persisted rollback
and real multi-connection races. Scope `app.modules.stock_receipts`: **100%
statements/branches**; retain combined M01–M14 gate.

| Responsibility | Success / failure / boundary |
| --- | --- |
| Create | neutral optional lines/key replay; missing/inactive/duplicate product; exact fractions/overflow |
| Header | date/note update; frozen404/409/stale412/missing428; nullable note/nonempty patch |
| List/detail | canonical summaries/full snapshots; wrong kind404/cursor400; all sorts/ties/half-open dates |
| Post | one batch/stock/cache; empty/frozen/inactive denied; backdated source and same-date tie |
| Cancel internal | retain draft history; posted denied; already cancelled/key replay |
| Transactions | complete commit; injected failure no audit/command/entries; duplicate key one winner |
| Races | receipt/receipt, receipt/issue, edit/post, master inactivation/post and revoke after wait |
| Publication | five exact contracts; missing/false grants; all seeded inventory dependencies |

Actual test nodes/symbols will be added before closure. Required unrun/skipped
tests keep gates open. Posted correction/cancellation tests belong to M29.

## Actual-symbol register

Nodes below live under `tests/integration/documents/`; parametrized families include
their positive, negative and boundary variants recorded in the combined run.

| Actual symbol | Passing nodes |
| --- | --- |
| `contains_product`, `StockReceiptRepository.__init__`, `query`, `StockReceiptService.__init__`, `get`, `etag`, `list` | `test_receipt_guards.py::test_list_filters_all_sorts_and_snapshot_freeze`, `test_duplicate_product_integer_unit_missing_preconditions_and_wrong_kind`, `test_contract.py::test_five_published_receipt_contracts_and_deferred_actions` |
| `StockReceiptService.result`, `command`, nested `command.authorize` | `test_receipts.py::test_receipt_draft_header_and_post_are_atomic_keyed_and_exact`, `test_receipt_guards.py::test_definite_commit_failure_rolls_back_each_receipt_workflow`, `test_internal_draft_cancel_requires_only_cancel_and_preserves_lines`, real revocation races |
| `StockReceiptService.create`, nested `create.work` | receipt lifecycle; nine invalid-input variants; duplicate/integer/overflow guards; same-key create race; prepare-only/denied/anonymous policies |
| `StockReceiptService.lock_draft`, `update`, nested `update.work` | lifecycle missing/stale/frozen preconditions; wrong-kind404; rollback; post/edit dependency restart in both orders; lock-wait revocation |
| `StockReceiptService.post`, nested `post.work` | lifecycle; empty/rounded-zero/inactive/current-stock-overflow guards; backdated/same-day/wide-quote prices; same-key and competing receipts; READY issue/master/edit races; mixed seed kinds |
| `StockReceiptService.cancel_draft`, nested `cancel_draft.work` | internal cancel-only authorization, retained lines, replay/already-cancelled guard and commit-failure rollback; no public partial cancel route |
| `get_stock_receipt_service`, `list_stock_receipts`, `get_stock_receipt`, `create_stock_receipt`, `update_stock_receipt_draft`, `post_stock_receipt` | five exact runtime contracts; single-grant/false/anonymous HTTP tests; direct/Nginx `test_03_goods_smoke.py` |

Projection lambdas are included in their enclosing workflow's evidence. DTOs have
no new custom validators; shared numeric/date/ID and PatchModel validators retain
their prerequisite tests. Owned198 statements/24 branches are independently100%.
