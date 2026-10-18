# M18 tests

Confirmed seams: HTTP, services, real PostgreSQL state/rollback/races. Owned gate
100% statements/branches; actual symbols/test nodes registered before completion.

- Exact create/header/list/detail/post, cash/bank, neutral draft, terminated agency.
- Positive/maximum/one-over amount, future invoice exclusion, same-day FIFO and full allocation.
- Multiple receipts/invoices, valid backdated mixed-history replay and provenance protection.
- Reject automatic/online/separated mutation, missing/wrong-kind IDs, bad dates,
  stale/missing ETags, unauthorized/false/revoked grants and invalid cursor scopes.
- Duplicate intent, competing receipts, post/header race and injected commit rollback.
- Canonical OpenAPI request/response/header/media/permission validation and Docker smoke.

## Actual-symbol register — 2026-10-17

Test nodes live in `backend/tests/integration/workflows/`. Nested workflow callbacks
and result lambdas are covered with their enclosing method; shared composition is
registered in [M17 TESTS](../stock_issues/TESTS.md).

| Actual symbols | Success / failure / boundary evidence |
| --- | --- |
| `PaymentReceiptService.create_internal`, `create` | `test_receipts::test_manual_receipt_allocates_fifo_without_overpay_or_future_invoice`; `test_guards::test_manual_receipt_header_special_receipts_and_commit_rollback`; `test_upfront` automatic cash; separation/replacement case in `test_guards`; date/type/method/positive input cases in `tests/workflows/test_schemas.py` |
| `PaymentReceiptService.lock_manual_draft`, `update`, `cancel_draft` | `test_guards::test_manual_receipt_header_special_receipts_and_commit_rollback`; `test_boundaries::test_net_limit_and_backdated_receipt_replay_keep_atomic_balances`; manual patch, immutable agency, special/posted receipt denial, cancellation and failed-commit persisted rollback |
| `PaymentReceiptService.post` | `test_receipts`; `test_races::test_competing_manual_receipts_cannot_pay_same_debt_twice`; `test_remaining_boundaries::test_backdated_receipt_reassigns_later_allocations_append_only`; `test_history` seeded dependencies; `test_authorization` current-grant checks after observed waits and same-key claim waits |
| `PaymentReceiptRepository` inherited initialization/query | `test_pages::test_all_read_filters_sort_pages_and_cursor_scopes`; each sort/tie/anchor, literal q, type/method/source/date filters; lifecycle detail and wrong-kind tests |
| `get_payment_receipt_service`, five router functions | Five canonical operations in `tests/workflows/test_contract.py`; HTTP lifecycle/header/error/grant tests in `test_receipts`, `test_guards`, `test_authorization`; direct/Nginx `tests/deployment/test_04_financial_workflows_smoke.py` |

Owned DTOs have no custom validators. Success/strict failure/boundary inputs are
mapped in `tests/workflows/test_schemas.py`; inherited PatchModel gates retain tests.
All owned files independently have exact100% statement/branch coverage in the
80-case combined M17–M20 owning gate.
