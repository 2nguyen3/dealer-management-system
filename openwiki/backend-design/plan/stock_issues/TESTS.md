# M17 tests

User-confirmed seams: HTTP contracts, caller-owned document/settlement services,
persisted-state/rollback and independent PostgreSQL connections. Owned statement and
branch gate: 100%; retain prerequisite regression. Required unrun cases keep gates open.

- Neutral draft/header, empty/duplicate/fraction/price/overflow inputs, missing IDs,
  inactive masters/terminated agency/acceptance date and immutable agency.
- Submit snapshots/neutrality; price change between create/submit and submit/post;
  current stock/net limit, no-money posting, old revision immutability and replacement.
- Exact canonical request/response/permission/header/status contracts and signed cursor scopes.
- Same-key/different-key concurrency, competing stock/credit limit, edit/submit/post,
  late grant revocation and definite commit/constraint failure persisted rollback.
- Valid backdated insertion before existing money/return/credit/refund history.
- Register actual symbols and test nodes as implemented, before closing any gate.

## Actual-symbol register — 2026-10-17

Nodes are under `backend/tests/integration/workflows/` unless stated otherwise.
Nested `work`, `authorize`, `project` and projection lambdas are included with their
enclosing workflow. DTOs add no custom validators; strict inputs are exercised in
`tests/workflows/test_schemas.py` and canonical contracts in `test_contract.py`.

| Actual symbols | Success / failure / boundary evidence |
| --- | --- |
| `StockIssueService.prepare_lines`, `validate_agency`, `validate_payment`, `create` | `test_issues::test_issue_draft_submit_and_zero_money_post_freeze_prices_and_record_once`; `test_guards::test_issue_guards_and_failure_rollback_preserve_document_history`; `test_remaining_boundaries::test_zero_rounded_total_terminated_agency_and_changed_overview_anchor`; exact input/duplicate/fraction/missing/state/total guards, persisted failed-command rollback |
| `StockIssueService.lock`, `update` | `test_guards::test_issue_guards_and_failure_rollback_preserve_document_history`; `test_remaining_boundaries::test_submit_detects_line_dependency_change_and_retries_with_stale_etag`; wrong-kind404, missing428/stale412, exact Decimal patch, failed commit and real changed-dependency retry |
| `StockIssueService.submit` | `test_issues`; `test_boundaries::test_submit_post_current_eligibility_limits_zero_totals_and_rollback`; `test_review_regressions::test_submit_repricing_checks_line_and_total_overflow_before_database_write`; `test_remaining_boundaries::test_zero_rounded_total_terminated_agency_and_changed_overview_anchor`; refresh/freeze, zero/empty/limit/overflow, rollback |
| `StockIssueRepository.check_stock`, `StockIssueService.post` | `test_races::test_competing_issues_cannot_oversell_and_same_key_create_is_single_intent`; `test_boundaries` net-limit and rollback cases; `test_review_regressions` wide-balance case; `test_history` mixed seven-kind evidence; `test_authorization` observed post-wait revocation; both post/separate lock orders |
| `StockIssueService.replace_pending`, `cancel_draft` | `test_guards` issue rollback and separation/replacement cases; `test_boundaries` replacement commit rollback; old READY preserved, VERIFIED blocked, separated evidence not consumed again, draft cancel retains lines |
| `get_stock_issue_service`; all seven router functions | `tests/workflows/test_contract.py` exact seven methods/paths/request/response/headers/permissions; HTTP nodes in `test_issues`, `test_guards`, `test_upfront`, `test_authorization`, `test_pages`; `tests/deployment/test_04_financial_workflows_smoke.py` direct/Nginx |

### Shared financial composition ownership

| Actual symbols | Evidence |
| --- | --- |
| `financial.authorize_any`, `agency_balance` | `tests/workflows/test_schemas::test_any_permission_checks_retain_account_errors_and_accept_each_reader`; `test_boundaries::test_receivable_boundaries_and_service_authorization`; `test_authorization` each single-grant balance reader; `test_pages` exact projections |
| `FinancialDocumentService.__init__`, `get`, `etag`, `list`, `result`, `command`, `lock_agency`, `source`, `check_date`, `snapshot`; `FinancialDocumentRepository.query` | Both issue/receipt lifecycle, guards, persisted rollback, mixed-history, all-sort pagination, wrong-kind/date, post-wait authorization and same-key races above; `test_pages`; exact100% per-file coverage |

M17–M20 plus these shared files: **808 statements/98 branches, exact100%** in the
80-case owning run; no missing/excluded statements or missing/partial branches.

### Supabase verification infrastructure

`tests.support.supabase.validate_schema`, `rewrite_sql`, `schema_engine` and its
connection/cursor callbacks, `migrate_schema`, `supabase_database_factory` and its
context-managed `create` are exercised by `tests/shared_api/test_schema_isolation.py`,
`tests/integration/workflows/test_isolation.py`, retained migration/ORM-drift/seed
tests, and all real workflow/race fixtures. Isolation tests reject schema injection,
unrecognized SQL representations and uppercase schema bypasses; an independent
runtime connection verifies business document count/migration version unchanged
after isolated base/head/downgrade/re-upgrade. Fixture cleanup uses generated names only.

`tests.support.database.selected_database_factory` retains explicit opt-in selection
and default disposable-URL guards. `race_timeout` is tested in
`tests/shared_api/test_race_budget.py` for absent/zero/one opt-in and exercised by
observed-blocking retained races. These test-infrastructure files are separate
from the808/98 production owning coverage scope; no whole-harness100% claim is made.
