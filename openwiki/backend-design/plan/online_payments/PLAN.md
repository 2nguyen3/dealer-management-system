# M26 — online payments

## Native VNPAY delivery — 2026-10-25

Current: merchant IPN registration confirmed by actual automatic delivery for payment37;
native signed query/refund transport is accepted and current API publication includes
all six M26 operations. External refund15714325 remains bank-processing PENDING.

User supplied merchant credentials and authorized M26/M27/M28 integration and testing
on existing Supabase UUID test schemas. Implement the native adapter and two provider
transport endpoints described in [VNPAY](VNPAY.md). These GET IPN/Return transports do
not replace or change the canonical signed-JSON webhook contract. Prepare native
callback reachability first; publish business routes only with required evidence.

## VNPAY sandbox configuration preparation — 2026-10-25

User selected VNPAY sandbox and reports merchant registration complete. Prepare native
settings before adapter work: sandbox checkout/query endpoints, merchant TmnCode,
SecretStr HashSecret and distinct HTTPS IPN/Return URLs. At the user's request,
use only `backend/.env` for local Settings and Compose; remove the separate native
dotenv file so blank defaults cannot override credentials entered in the main file.
Blank credentials with prepared URLs are valid preparation; supplying either credential
requires both credentials and both callback URLs. Validate URLs without network I/O.
No native route, checkout dispatch, money mutation or publication is part of this slice.
Actual credentials, native IPN/query/refund integration and external acceptance remain
separate gates. Register/test all new settings validators before recording completion.

Prepared before M26 code. Follow M25→M26→M27→M28 execution order. Prerequisite M24
provides credit reads; M16 already supports full ONLINE cash and surplus provenance.
Canonical six operations: listOnlinePayments/createOnlinePayment/getOnlinePayment/
listPaymentEvents/reconcileOnlinePayment/receiveVerifiedPaymentWebhook. Source:
`../../API/openapi.json`; no separate copied HTTP specification.

Phases: resolve D07 boundary; reproduce missing restart-safe checkout storage; design
reviewed recovery storage if required; strict adapter/schemas and raw HMAC; durable TX1;
shared event-completion TX2; reads/reconcile; controlled HTTP/PG races/recovery; coverage/
reviews; isolated image/direct/Nginx verification. Keep routes unpublished until full
operation and deployment gates pass. Accepted external sandbox is currently unavailable.
