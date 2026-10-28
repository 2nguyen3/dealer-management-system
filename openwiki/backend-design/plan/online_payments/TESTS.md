# M26 tests

## Native actual-symbol register — implemented 2026-10-25

| Actual symbols | Success/failure/boundary evidence |
| --- | --- |
| `vnpay.amount_to_vnpay/amount_from_vnpay/native_time` | `test_vnpay` exact round trips, integer/boundary/nonfinite/fraction/time rejections; native PG oversized intent rollback |
| `vnpay.checksum/checked_signature` | known URL-encoding and pipe-order HMAC vectors, uppercase checksum, bad/missing proof, native query/refund response identity tests |
| `VnpayAdapter.__init__/bind/sign/verify_callback/create_checkout` | `test_vnpay` detached contexts, stable original dates, duplicate/oversized/foreign-merchant callbacks; actual native PG create/GET IPN |
| `VnpayAdapter.payment_evidence/api_fields/call_api/query_payment` | pending/failure/late-success/zero-ID normalization, strict signed API response and transport faults; native PG query with independent NOWAIT lock probe |
| `VnpayAdapter.request_refund/query_refund/refund_evidence` | stable RequestId/source/actor, full02/partial03, known refund identity, ambiguous queries, signed09 observation time; native PG pending/timeout/success/failed-release persistence |
| `vnpay.bind_adapter/provider_for`, changed `adapter_for/get_online_payment_service/get_refund_service` | native/controlled composition tests, native authenticated PG route, published deployed packet reads |
| `vnpay_router.native_adapter/vnpay_ipn/vnpay_return` | `test_vnpay_http` all RspCode/error/readonly/escaping cases; native PG rollback/duplicate/late success; real automatic dev IPN |

Native unittests cover every statement/branch of both new production files. Combined
offline/owning PostgreSQL coverage includes changed service/repository/composition
files; exact current results and original-period checkpoints are in VERIFICATION.

Native adapter/route/service integration inherits the success/failure/boundary,
persisted-state and external acceptance register in [VNPAY](VNPAY.md).

## VNPAY configuration symbol register — preparation slice

`Settings.validate_vnpay_url` and `Settings.validate_vnpay_credentials`:
`tests/online_payments/test_vnpay_settings.py` must cover blank preparation, valid
complete settings, exact merchant length/alphabet, missing credential/callback,
whitespace-only secret, HTTPS and malformed URL boundaries, secret-safe errors/repr,
literal sandbox endpoint enforcement and main dotenv/environment precedence.
Retain existing controlled-provider settings and full offline regressions. Validate
Compose with the main env file; built-image safe settings inspection
must not imply provider acceptance or mount native routes. No database mutation in
this configuration-only scope; no new PostgreSQL fixture is required.

Require exact100% statements/branches per owned/changed production file and new Python
migration. Register actual callables/test nodes as introduced. Offline adapter/HMAC/
schema tests have no Supabase dependency. Real HTTP fixture is separately running and
supports lost replies, invalid replies, idempotent references and status changes.

Required behavior groups:

1. HMAC raw bytes before parsing, wrong key/provider/case/signature, timestamp±300/301,
   duplicate headers and malformed signed JSON; no secret sentinel in safe errors/audit.
2. TX1neutralPENDING, exact/current-debt one-over bounds, competing initiation without
   reservation, same-key/changed-body/restart recovery and persisted checkout.
3. Fullsuccess after intervening manual cash; lateFAILED/EXPIRED→SUCCESS; duplicate and
   conflicting events, terminalSUCCESS nonregression, provider/reference/amount mismatch.
4. Independent-connection webhook/reconcile and duplicate-event races; rollback after
   each money stage and definite/unknown commit outcome; no ack before commit.
5. List/detail/events exact grants/filters/cursors/ownership/media/status/header contract.
6. Fresh/populated upgrades/down/up/seed/integrity, built-image runtime HTTPX, locked
   dependencies and isolated direct/Nginx probes. External acceptance remains required.

Use only SUPABASE_TEST_SCHEMAS=1 generated UUID domain/metadata schemas. Never test
money fixtures in live dms. Retain M16–M25 evidence and seven-kind financial conservation.

## Actual-symbol register (gates pending)

- adapter.verify_signature: test_adapter::test_signature_exact_boundaries_before_json,
  ::test_bad_signature; test_http_transport raw-before-parse.
- adapter.SandboxAdapter.__init__/request/create_checkout/query_payment: test_adapter
  transport safe-error parameterization and test_real_http controlled local server.
- schemas.OnlinePaymentCreate/VerifiedPayment.require_success_time/Checkout/OnlinePayment/
  VerifiedData/PaymentEvent/OnlinePaymentList/PaymentEventList/WebhookAcknowledgement:
  test_contract, test_adapter exact-money/time, integration recovery/completion/HTTP.
- repository.OnlinePaymentRepository.__init__/get/reference/create/event/append_event:
  integration test_recovery, test_completion, test_races, test_http (required cases ongoing).
- service.OnlinePaymentService.__init__/project/get/authorize_write/create/setup/complete/
  list/events/page/reconcile: same four integration suites; all branches not yet covered.
- dependencies.adapter_for/get_online_payment_service/get_webhook_service: test_http_transport
  and integration test_http; complete production configuration coverage pending.
- router.payment_responses/list_online_payments/create_online_payment/get_online_payment/
  list_payment_events/reconcile_online_payment/payment_webhook and generated Reader/Writer:
  five source contract nodes, test_webhook_contract, raw-before-parse and actual HTTP.
- Settings new payment-validation branches: test_http_transport configuration cases;
  retained test_config/auth settings tests needed for changed-file100%.

Registration does not close missing tests. Exact symbol/branch evidence remains pending.

Final additions: `common.provider_commands.finish_provider_command` is registered by
`tests/online_payments/test_provider_commands.py` and real lost-result-commit/replay
cases in integration test_failures/test_http. `OnlinePaymentService.finish_reconcile`
is exercised by those nodes plus pending recovery. `test_remaining_recovery` verifies
callback-during-reconcile-setup retains the correct reconcile command identity and
historical pending records without a setup command remain readable/reconcilable.
`test_real_transport_recovery` uses a real HTTP server, lost socket reply, a new service
session and an independent NOWAIT agency-lock probe. Payment race tests run both winners.

`SandboxAdapter.transport` is covered by real-socket transport and a regularly
dribbling response that must hit the total deadline. Bounded TX1 retries have a
three-attempt/no-dispatch exhaustion test and a real persisted-intent recovery case.
`PAYMENT_SELECT` and `project_event` are covered by `test_seeded_reads`: all20seeded
payments/events remain readable without changing evidence, and a real callback
commits at the page-query boundary while a PENDING-filter response stays coherent.
The pure legacy-event projection test forbids echoing extra/raw fields or inventing
an unknown provider transaction identifier.

Final source-derived response schema tests also check the required accepted=true
webhook acknowledgement and SUCCESS evidence/time conditions. The read projection
is a compatibility view only; it never accepts old demo flags as external proof.
