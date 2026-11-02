# M25 test plan and actual-symbol register

Gate: exact 100% statements AND branches per owned production file, no excluded/missing/
partial coverage; changed shared files measured separately. Offline tests must not
connect to Supabase. PostgreSQL tests explicitly set SUPABASE_TEST_SCHEMAS=1 and use
generated UUID domain/metadata schemas. Persisted assertions use fresh connections.

Proposed symbols (replace/register actual test nodes as implemented):

| Responsibility | Success/failure/boundary evidence required |
| --- | --- |
| CreditApplicationCreate/Update | strict strings, positive/maximum/one-over, extras/null/empty patch |
| CreditApplicationRepository.rows | all filters/sorts/ties, scoped cursor, empty page |
| CreditApplicationService.create/update/lock_draft | neutral draft, acceptedDate, wrong kind/state, stale ETag, reauthorization |
| CreditApplicationService.post | many lots/invoices, exact/one-over debt and credit, future credit/debt exclusion, protected reservations, cashReceived=0 |
| CreditApplicationService.cancel_draft | reason/context, neutral cancellation, wrong state and same-key recovery |
| dependency and five routes | canonical transport/status/schema/headers/grants, safe errors |

Required real-PG scenarios: multiple original cash receipts across multiple invoices,
later return retaining origins; both reservation/application race winners; competing
applications; rollback after ledger append/deferred/commit failure; matching/changed
key retries; grant revoked during observed lock wait; later seeded kinds replay.
Retain affected M16–M24 tests and direct/Nginx lifecycle evidence before closure.

## Actual symbols and executable nodes (implementation in progress)

| Actual symbols | Owning tests |
| --- | --- |
| schemas.CreditApplicationCreate, schemas.CreditApplicationUpdate; inherited PatchModel validation | tests/credit_applications/test_contract.py::test_strict_amount, ::test_schema_boundaries_and_patch; integration test_http::test_header_edits_filters_grants_and_safe_errors |
| repository.CreditApplicationRepository kind binding and inherited query/filter/cursor behavior | integration test_service::test_service_drafts_boundaries_rollback_and_cancel; test_http::test_header_edits_filters_grants_and_safe_errors |
| service.CreditApplicationService.create / nested work | test_posting::test_neutral_draft_post_and_same_key_recovery; test_http::test_header_edits_filters_grants_and_safe_errors; test_service::test_service_drafts_boundaries_rollback_and_cancel |
| service.CreditApplicationService.lock_draft/update and nested work | test_service::test_service_drafts_boundaries_rollback_and_cancel; test_http::test_header_edits_filters_grants_and_safe_errors; test_authorization::test_live_apply_permission_revoked_during_balance_lock_wait |
| service.CreditApplicationService.post and nested work/project | test_posting both nodes; test_races all three nodes; test_chronology both nodes; test_service rollback/state nodes |
| post definite rollback and one-over availability | test_boundaries::test_one_over_credit_and_definite_commit_failure_restore_entire_post[credit], [commit] |
| post with existing protected future money sources | test_protected_sources::test_actual_application_preserves_reserved_and_paid_refund_sources[False], [True] |
| service.CreditApplicationService.cancel_draft and nested work/project | test_service::test_service_drafts_boundaries_rollback_and_cancel |
| dependencies.get_credit_application_service; router.list_credit_applications/get_credit_application/create_credit_application/update_credit_application/post_credit_application; Reader/Writer generated dependencies | all five canonical test_contract cases; test_http, test_posting, test_authorization actual HTTP/live-auth nodes |

Paths above are relative to tests/integration/credit_applications unless explicit.
Test registration is not passing evidence; consult VERIFICATION for completed nodes.
