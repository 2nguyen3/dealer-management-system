# M27 tests and gates

## Native VNPAY extension — 2026-10-25

`OnlineRefundService.dispatch` binds detached original payment/attempt/actor context
through `online_payments.vnpay.bind_adapter`; native codec/response symbols are
registered in M26 TESTS. `test_vnpay` covers exact source/amount/type/signatures,
stable retries and ambiguity. `integration/online_payments/test_vnpay` proves actual
reservation retention, duplicate SUCCESS and signed FAILED release on Supabase.
Native FAILED status09 uses signed PayDate when supplied, otherwise the time the
verified terminal rejection is observed; it never invents an actual payout date.
Real external request/query matched refund15714325/5000VND and status05/PENDING.
External terminal payout is still pending, and is not represented as SUCCESS.

Exact100% statements/branches per owned/changedproduction file; register all actual
symbols/testnodes. Offline strictschema/adapter/contract tests never useSupabase.
PG tests explicitly SUPABASE_TEST_SCHEMAS=1 with UUID domain/metadata schemas and
independent persisted-state/rollback assertions. No fixtures in live dms.

Required: neutral drafts/source-derivedagency/wrongsource/method; sourcecash cap and
available exact/oneover; reserved content freezes/ETag; actual Vietnam date/evidence;
paid immutability; both manualconfirm/cancel winners, reserve/application and two
refund races; failure after revision/batch/debit/consume and definite/unknowncommit.
Online: durablePendingbeforeI/O, timeout/restart/querysameattempt, unknownretains,
definitivefailure releases, retry after credit changes/newrevision/reservation/key,
wrong original payment/amount/reference, duplicatesuccess, identifiedasyncactor.
Canonical12operation schemas/permissions/cursors/headers/media must match source.
Retain M16–M26 financial regressions, exact coverage/review/deployment evidence.
D07 external deployment acceptance is separately required and currently blocked.

## Actual symbol register (verification in progress)

| Actual symbols | Executable owning evidence |
| --- | --- |
| RefundCreate/RefundUpdate/ManualRefundConfirmation; VerifiedRefund.require_terminal_evidence; RefundAttempt/List and RefundReservation/List | tests/refunds/test_contract.py all12canonical operations; test_adapter strictvalues/terminalproof; integration manual/online/HTTP |
| RefundRepository kind/latest-attempt filter | integration test_http::test_manual_http_contract_grants_parent_etags_and_evidence_filters |
| RefundService.source_receipt/create/lock_draft/update/submit/reservations/post_paid/confirm_paid/cancel, nested work/project/authorize callbacks | integration test_manual, test_guards_races, test_http, test_authorization; all mutation results checked from independent connections |
| OnlineRefundService.__init__/attempt/project_attempt/request/dispatch/mark_unknown/complete_attempt/reconcile | integration test_online, test_retry; additional crash/provider/error tests remain required |
| RefundEvidenceReads.__init__/attempt/page and cursor lambdas | test_http and isolated direct/Nginx packet probe; full branch coverage pending |
| get_refund_service; refund_responses/emit and twelve route handlers/generated grant dependencies | test_contract all12routes; test_http actual manual routes; controlled provider deploymentprobe; full grants/coverage pending |

Registration is not a claim of fullmodule closure. Refer to VERIFICATION for actual
complete setup/call/teardown records and remaining coverage/acceptance gaps.

Additional actual symbols: schemas.DefinitiveRefundAbsence; shared adapter refund
request/query and authoritative-absence decoding; shared finish_provider_command.
Tests/refunds/test_adapter rejects generic/mismatched404 and verifies UNKNOWN with
omitted completion time serializes safely. test_error_paths checks safe definite/
ambiguous intent failures, missing initiating-actor recovery and unsuppressed business
conflicts. Integration test_online verifies pre-dispatch crash/same-reference recovery,
UNKNOWN/timeouts, terminal duplicate/conflict, original actor under a different poller,
actual online HTTP handlers and final-result commit-reply loss. test_retry exercises
all evidence cursor directions across old/new revisions. test_authorization includes
each missing cancellation grant on completed replay; test_guards_races includes both
actual M25-application/M27-submit winners and mid-post persisted rollback.
