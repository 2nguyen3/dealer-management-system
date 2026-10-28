# Native VNPAY 2.1.0 delivery

Prepared before native code on 2026-10-25. Merchant credentials are supplied in the
main backend `.env`; never copy them to evidence. Use the official sandbox payment
and query/refund documentation linked in backend README. Supabase tests use only
`SUPABASE_TEST_SCHEMAS=1`; no new database instance or schema migration is planned.

## Native/canonical boundary

- `vnpay.VnpayAdapter` is session-free, bound to detached payment/attempt context.
  Stable payment createdAt/expiresAt determines CreateDate/ExpireDate across setup
  retries. Checkout signs sorted URL-encoded query parameters with HMAC-SHA512.
- Strict integer VND conversion: positive amount, amount-times-100 has at most12digits;
  reject fractions/out-of-range before committing a new native payment intent.
- Querydr/refund use pipe-joined documented field order and verify response HMAC
  before examining provider outcomes. Reject changed merchant/reference/amount/type.
  Query errors, invalid JSON/signatures and response ambiguity never authorize cash.
- Bind query/refund to original payment creation date and transaction number. Refund
  RequestId is a stable32-character digest of the durable attempt reference. Refund
  OrderInfo binds that exact attempt; queries which cannot establish the same attempt
  remain UNKNOWN. Original-payment query results are never refund-success proof.
- ResponseCode00 alone is not payout success: TransactionStatus and terminal evidence
  are required. Pending05/06 and duplicates/timeouts retain reservations. Query91 is
  not authoritative absence of this specific refund; never automatically redispatch.
- Native failure transaction number0 is absence, not a permanent successful-payment
  identity. It cannot prevent a later verified success or overwrite a successful ID.
- Native service composition selects VNPAY only when its credentials are present;
  controlled PAYMENT_* composition remains supported independently for fixtures.

## Provider transports

`GET /api/v1/integrations/vnpay/ipn`: reject duplicate query parameters; verify native
signature and merchant before parsing. Map verified business evidence into the shared
completion transaction. RspCode00 only after commit,02 for already processed,01 for
missing reference,04 for amount conflict,97 for invalid proof and99 for retryable
failures. Missing transaction and non-money-conflict failures are not acknowledged as
success. These transport endpoints are documented separately from the154canonical
business operations and are excluded from business Swagger operation accounting.

`GET /api/v1/integrations/vnpay/return`: verify native proof, render escaped Vietnamese
HTML with no-store/referrer policy; never invoke completion or mutate state. Display
that the application status depends on server IPN/reconciliation. No browser parameter
can authorize money. Public IPN requires merchant registration with VNPAY.

## Test/acceptance register

User approved actual sandbox-card acceptance on the unchanged dev server after IPN
registration, 2026-10-25. `tests.support.vnpay_dev_payment` creates a normal10200VND
VNPAY intent using live authenticated permissions and an existing agency debt; its
real IPN receipt is a development business record, not an isolated fixture. Preserve
that immutable receipt and report count/balance changes explicitly. Do not reset the
database or switch the current ngrok upstream. Automated money fixtures remain in
generated Supabase test schemas.

- `tests/online_payments/test_vnpay.py`: sign/checksum, exact money/time, checkout
  stability, duplicate/raw callback boundaries, native query/refund signatures and
  identity mismatches, safe errors, response statuses/timeouts and ambiguity.
- `tests/online_payments/test_vnpay_http.py`: native IPN RspCode mapping and Return
  no-mutation/escaping; no secrets/raw signature echoed; disabled provider behavior.
- `tests/integration/online_payments/test_vnpay.py`: native full lifecycle through
  authenticated create, signed GET IPN and query, duplicate/late success, persisted
  one-receipt invariants/rollback, read-only Return, detached query/transport and
  refund UNKNOWN reservations/source identity. Use real Supabase temporary schemas.
- Register every actual native helper/method/route in owning TESTS after implementation;
  require exact per-file100% statements/branches across native/changed scope.
- Existing M26/M27/M28 owning and affected shared/retained tests remain required.
  Real VNPAY browser payment/IPN/query/refund evidence is separate from controlled
  signed fixtures. Missing external access leaves acceptance/publication open; record
  precise progress and any required merchant action instead of closing that gate.
