# M19 tests

Confirmed HTTP/service/persistence/race seams; 100% owned statements and branches.

- Verify exact amount/revision, neutral balances, wrong state/kind/amount/method/date,
  duplicate evidence, response ETag and independently permitted readers.
- Atomic issue+auto receipt with gross-over/net-within limit; exact original invoice
  allocation; preserve READY snapshots and one source of real cash.
- Failed stock/limit/commit leaves VERIFIED and no partial cash/stock/debt/audit/command.
- Separate full cash with zero/partial/full eligible debt, credit provenance, Vietnam
  midnight, terminated agency, reason, stale/missing ETag and same-key recovery.
- Verify vs replacement, duplicate verify, post vs separate in both observed lock
  orders, competing posts, post-wait grant revocation and rollback at each boundary.
- Separate then new pending revision; old evidence cannot be recycled/consumed.
- Canonical contracts, mixed-history replay and direct/proxy lifecycle smoke.

## Actual-symbol register — 2026-10-17

Nodes below are in `backend/tests/integration/workflows/`; nested verify/separate
work/project closures are included with their owning workflow.

| Actual symbols | Success / failure / boundary evidence |
| --- | --- |
| `UpfrontRepository.__init__`, `query`, `source`, `for_revision` | `test_upfront::test_verified_cash_is_consumed_atomically_or_separated_with_excess_credit`; `test_boundaries::test_upfront_wrong_revision_amount_duplicate_and_commit_failures`; `test_pages` state/agency/issue/time/keyset reads; unknown/wrong-kind/current-revision and duplicate evidence |
| `UpfrontRepository.insert`, `finish` | `test_upfront`; `test_guards::test_separation_creates_full_cash_credit_and_replacement_preserves_ready_history`; `test_boundaries` invalid terminal state and failed-commit state equality; both observed post/separate lock orders in `test_races` |
| `UpfrontPaymentService.get`, `etag`, `list` | `test_pages`; `test_authorization::test_http_read_permissions_and_no_extra_cash_permission_for_issue_post`; creation interval error in `test_boundaries`; exact complete-detail ETags and single-grant readers |
| `UpfrontPaymentService.verify` | `test_upfront`; `test_boundaries` amount/revision/date/duplicate/state/rollback cases; mixed seeded history in `test_history`; strict aware instant/manual method/single revision schema cases in `tests/workflows/test_schemas.py` |
| `UpfrontPaymentService.separate` | `test_guards` separation/replacement and same-key replay; `test_boundaries` failed commit/consumed-state denial; `test_races::test_issue_post_versus_separation_records_exactly_one_receipt` both orders; full cash/credit, Vietnam date and provenance checks |
| `get_upfront_service`, four router functions; M19 branches of `StockIssueService.post`/`replace_pending` | Four canonical contracts in `tests/workflows/test_contract.py`; HTTP verify/detail/separate/replacement; sole stock.issue.post grant can produce automatic receipt in `test_authorization`; direct/Nginx financial lifecycle smoke |

DTOs add no custom validators. Every owned file independently has exact100%
statements/branches in the 80-case M17–M20 owning gate. Whole issue cancellation
remains a required M29 integration, not a published partial operation.
