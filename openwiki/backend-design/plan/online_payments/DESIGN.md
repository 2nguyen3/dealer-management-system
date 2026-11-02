# M26 design

## VNPAY native configuration boundary — 2026-10-25

Add `Settings.vnpay_payment_url/vnpay_api_url` with literal official sandbox endpoints,
`vnpay_tmn_code`, SecretStr `vnpay_hash_secret`, `vnpay_ipn_url/vnpay_return_url`.
`validate_vnpay_url` rejects malformed/non-HTTPS/credential-bearing/query/fragment
URLs; `validate_vnpay_credentials` permits blank preparation but rejects incomplete
merchant credentials/callbacks. Neither validator makes external calls.
Read only the main `.env` locally and through Compose; the user requested removal
of the separate VNPAY env file. Use the current ngrok HTTPS base with proposed
`/api/v1/integrations/vnpay/ipn` and `/return` paths in that main local file.
These handlers are not implemented yet.
The future native adapter must sign sorted/encoded `vnp_*` parameters using
HMAC-SHA512, convert exact VND to integer amount-times-100, verify GET IPN and return
VNPAY RspCode/Message after commit. The existing canonical POST webhook is not a
VNPAY IPN and must not be configured as one.

Provider boundary is typed and session-free: create_checkout/query_payment and later
request_refund/query_refund. Bounded HTTPX transport validates response shapes and
sanitizes failures. Promote HTTPX to runtime with frozen lock update when used.
Configuration contains explicit provider code, base URL, server credential, callback URL
and key-ID→SecretStr map; absent configuration does not invent sandbox credentials.

TX1 command claim → live authorization → agency type/agency/balance locks → amount
check → PENDING insert with internal merchant key and initiating actor → durable setup
metadata → deferred checks → accepted command result/recovery → commit. Release all
transactions before provider call. Same-key retries read current resource and recover
setup with the original stable key, never return permanently cached stalePENDING.

TX2 discovery → agency/balance/history/lot locks → payment lock → duplicate-event check →
exact reference/amount validation → append sanitized verified event. SUCCESS creates
one internal PAYMENT_RECEIPT/ONLINE for full money and actual Vietnam business date,
links payment before final constraints, posts via SettlementService, then commits.
Terminal success ignores non-success regression; conflicting successful evidence fails.
Reconciliation queries outside locks and invokes precisely this completion path.

Durable checkout/setup/dispatch metadata requires reviewed real FKs; first demonstrate
existing schema cannot retain checkout across a new process. Allocate migration only
after checking current head. Metadata never stores authentication/signatures/raw headers.
M27 will reuse recovery storage while preserving its initiating authorized poster.

Inspection refinement: existing api_idempotency ACCEPTED→COMPLETED transition can
retain TX1 recovery paymentId and then immutable checkout/result metadata without new
DDL. Domain payment already holds original stable idempotency key/actor/reference.
Use the creation command as setup recovery record; detail joins its safe result.
Complete once checkout is stored; further payment state is read from the domain row.
Reproduce actual inability before adding a table; no speculative migration is selected.

### Final recovery/adapter refinements

Reconciliation claims ACCEPTED intent before transport and keeps it recoverable for
PENDING; a terminal verified result is saved through
`common.provider_commands.finish_provider_command` after domain commit. Completed
replay returns its saved typed result and rechecks current grants after command waits.
The checkout-setup command ID is separate from the reconcile command ID, including
when a callback wins during checkout recovery. Invalid setup expiry after known TX1
acceptance returns202/current resource; reconcile may report its documented502.

The optional provider URL must implement the normalized controlled protocol, or an
explicitly accepted native-to-canonical translation. Checkout/query use stable
merchantReference and exact amount strings. M27 adds same-reference refund dispatch/
query. Only a typed404 body(code=REFERENCE_NOT_FOUND,definitive=true,matching
merchantRefundReference) proves absence; generic404/invalid JSON is not absence proof.
This engineering protocol is not a selection or acceptance of any external provider.

Default transport now uses a private async HTTPX loop behind the synchronous adapter
boundary, with an outer asyncio total deadline as well as socket deadlines. Thus a
provider dribbling headers/body cannot reset the deadline indefinitely. No database
session enters that transport loop. Definite serialization/deadlock failures in TX1
retry the same intent at most three times; ambiguous commits never blindly retry.

Legacy demo payment-event JSON contains simulation flags rather than normalized
business fields. The read projection whitelists recorded business values and fills
omitted immutable reference/amount from the linked payment. An unrecorded historical
transaction ID remains empty text (per the canonical string schema), not an invented
provider proof. SUCCESS time can come from its recorded parent payment. Reads never
rewrite the original event or assert external verification of DEMO_SANDBOX.
Payment list rows and stored checkout metadata are selected in one SQL snapshot,
preventing callback completion between filtering and an N+1 detail reload.
