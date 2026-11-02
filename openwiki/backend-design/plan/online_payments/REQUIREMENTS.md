# M26 requirements

## Native VNPAY settings preparation

- Native settings are separate from the controlled `PAYMENT_*` JSON/HMAC protocol.
- Use VNPAY sandbox 2.1.0 checkout and query/refund endpoint defaults; production
  endpoint selection is outside this preparation slice.
- Merchant code is eight alphanumeric characters when supplied; HashSecret is secret.
- IPN and Return URLs must be absolute HTTPS without credentials/query/fragment or
  whitespace. Empty callbacks are permitted only while credentials remain absent.
- Missing credentials may leave a prepared configuration; partial credentials or
  credentials without callbacks must fail with generic secret-free errors.
- The main `backend/.env` contains VNPAY settings for both local Settings and Compose;
  process environment remains higher priority for local Settings. No extra native
  dotenv file is loaded.
- Configuration does not register native routes, enable M26/M27 or accept browser
  Return parameters as money evidence.

- Q11: initiation0<amount≤currentDebt, no debt reservation. Any verified success records
  the full amount once, with eligible FIFO settlement and surplus original-receipt credit.
- Canonical six operations determine exact request fields, permissions and responses.
  payments.online writes/events; payments.online OR debt.read collection/detail;
  webhook signature only, never bearer/browser-return proof.
- D07/D01: PENDING intent/internal merchant key/recovery metadata must commit before
  network I/O. Lost checkout response/restart recovers the same key/reference.
- D11: HMAC lowercaseSHA256(timestamp UTF8 + dot + raw bytes), constant-time validation
  before JSON parsing; configured provider/key ID, ±300seconds inclusive.
- Validate exact full amount, provider/reference/transaction, conditional paymentTime,
  canonical event uniqueness; same event/different payload409. SUCCESS never regresses;
  verified late SUCCESS after FAILED/EXPIRED is accepted once.
- Webhook/reconcile use one locked completion path; one ONLINE receipt, event, immutable
  money proof, FIFO/excess ledgers, audit and outcome commit atomically. No200 before commit.
- D17: later returns/applications/reserved/paid-refund histories must replay correctly.
- D07 external acceptance remains blocked by missing accepted provider credentials,
  reachable callback and protocol mapping; controlled HTTP fixtures are engineering evidence.
