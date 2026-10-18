# Full backend technical design

**Status:** proposed implementation design, grounded in the current source.
Use with [DECISIONS](DECISIONS.md), [MODULES](MODULES.md) and the
[source contract](../../API/openapi.json). Names introduced below are proposed.

## 1. Architecture and ownership

Extend the current modular monolith. Keep the application factory, synchronous
request session, SQLAlchemy 2, reviewed PostgreSQL DDL and explicit commits.

```text
app/main.py                    composition, settings, middleware, resource lifetime
app/api/router.py             aggregates feature routers, mounted once at /api/v1
app/core/                     config/security/logging/exceptions/context/transactions
app/common/                   schemas/responses/transport/exact values/cursors/retries
app/db/                       shared Base/timestamps/session, seed and verification
app/modules/<feature>/
  router.py                   source operation IDs, dependencies, status/headers
  schemas.py                  strict requests and explicit safe response projections
  models.py                   uniquely owned mappings on the shared Base
  repository.py               caller-session persistence; no commit/rollback
  service.py                  domain workflows and transaction ownership
  dependencies.py             feature session/authorization/adapter wiring
  <focused helpers>.py        codecs, adapters and domain primitives as needed
```

These packages appear incrementally. Plan folder names track delivery ownership;
they need not create 32 almost-empty Python packages. Existing identity mappings
are uniquely owned by `app.modules.auth.models`, `app.modules.users.models` and
`app.modules.user_groups.models`; do not map the same table again for administration. Keep small
resource-specific services rather than a universal CRUD base class or one giant
document service with every workflow in an unbounded conditional.

This layout is implemented for the existing features and verified in the
[2026-10-04 refactor evidence](../../../../backend/REFACTOR_VERIFICATION.md).
Catalogue APIs, M13 document foundations, M14 inventory and M15 receipt core now
pass owning child evidence. Settlement/later payment/report/chatbot behavior and
M28/M29 full history/correction gates remain future work. SQL-owned catalogue and
document tables use typed Core projections; only explicitly Base-mapped tables
participate in ORM autogeneration.

### Interfaces and transaction boundaries

| Layer | Responsibilities | Commit authority |
| --- | --- | --- |
| Route | Validate transport, authenticate/authorize, call use case, emit typed response and source headers | None |
| Top-level use case | Lock/recheck, compose domain operations, finalize constraints, materialize result, commit | Exactly one per local mutation phase |
| Repository/query | Bound SQL/ORM, explicit eager projection, stable ordering and state reload | None |
| Document/inventory/settlement primitive | Add complete domain effects to caller's session | None |
| Provider adapter | Typed requests/evidence with bounded network deadlines | No session and no database locks |
| Renderer | Render an already authorized snapshot/dataset | No business writes |

Never call an internal HTTP route to compose an atomic write. Auth's existing
`invalidate_user_sessions` is a reusable no-commit primitive; `AuthService.login`
and password workflows remain top-level transactions, not nested business helpers.

## 2. Schema mapping and migration ownership

Map `schema="dms"`, quoted camelCase SQL names, exact domains, generated values,
identities, composite FKs and server-updated timestamps. Prefer SQLAlchemy Core
queries for ledger aggregates/views; do not force every read model into ORM state.

| Owner | Tables/read models |
| --- | --- |
| M01/M03–M05 | Existing five identity/access models; reuse them. |
| M06 | `audit_log`, read-only projection with field-aware numeric conversion. |
| M07–M12 | `district`, `agency_type`, `unit`, `business_rule`, `product`, `agency`; read-only cache projections. |
| M13 | `document`, `document_revision`, `document_line`, `posting_batch`. |
| M14/M15 | `inventory_entry`, `inventory_balance`, `inventory_overview`; append only through authorized workflows. |
| M16/M20/M24 | `receivable_entry`, `agency_balance`, `credit_lot`, `credit_entry`, `refund_reservation`, `invoice_balance`, `credit_availability`. |
| M19 | `upfront_confirmation`. |
| M22 | `stock_count`, `stock_count_line`. |
| M26/M27 | `online_payment`, `payment_event`, `refund_attempt`; reservation machinery reused. |
| M28–M32 | Existing views, report functions and parameterized derived queries. |

Proposed migration work, revision numbers assigned only after rechecking head:

1. **M02 durable command records:** add `dms.api_idempotency` with a scoped unique
   key and minimal recovery/result metadata. Add timestamps explicitly; 0001's
   one-time trigger installation loop will not install triggers on new tables.
2. **M11/M12 eligible owner deletion:** repair cache cleanup with narrowly guarded
   parent deletion/cascade; keep direct cache writes/deletes forbidden (D02).
3. **M26 provider recovery metadata:** persist checkout/setup/dispatch metadata
   separately from immutable money evidence (D07). Reuse it for M27 refunds.
4. **Conditional later repairs:** only after reproducing a guard/contract mismatch
   or proving that provenance cannot be reconstructed. No speculative migration
   that changes the selected business rules.

Every migration includes fresh/populated upgrade, seed compatibility and safe
downgrade/re-upgrade evidence on disposable PostgreSQL. Preserve 0001/0002/0003
snapshots. Update DBML/README and the verifier's explicit infrastructure manifest;
do not relax verification to “accept any tables.” Never require infrastructure
tables such as a retry registry to contain fake demo money or credentials.

## 3. HTTP contract foundations

### Exact values and validation

- Accept source numeric strings strictly: no JSON float/bool coercion, scientific
  notation, thousands separators, implicit rounding or nonfinite values.
- Distinguish BIGINT string IDs (up to 9223372036854775807) from integer CatalogId.
  Preserve separate stored-value and unbounded aggregate schemas.
- Use a deliberate Decimal context with sufficient precision for products/sums,
  then explicitly enforce each domain bound. Do not rely on Python's default
  28-digit context for arbitrary report totals or a 15-digit quantity × price.
- Selling price is HALF_UP(base price × rate), then each line is HALF_UP(quantity
  × rounded unit price). Total is the sum of rounded lines. A return uses cumulative
  rounding; adjustment price and total are zero.
- Validate real calendar dates and timezone-aware instants; Windows/container
  availability of `ZoneInfo("Asia/Ho_Chi_Minh")` is part of M02 setup (add locked
  tzdata if required). Do not silently accept a local naive timestamp.
- PATCH distinguishes omitted from explicit null and rejects an empty update;
  source nullable fields alone can be cleared. Password bytes stay unchanged.

Derived quotes need their own range decision (D16): individually valid purchase
price and rate can yield a selling price outside source Money, or round to zero.
Keep exact intermediate arithmetic and distinguish quote serialization from
positive stored issue-price/line-total validation. Resolve the source contract
before shipping affected projections; do not allow response validation to discover
this only after the transaction has committed.

### Errors, content and authorization

Generalize the existing safe Error response path while preserving the health and
auth contracts. Malformed JSON is 400, unsupported body media is 415, semantic
validation is 422. Required version headers are handled explicitly as 428, not
FastAPI's default missing-field 422. Invalid version syntax is validation failure;
valid-but-stale preconditions produce 412 with current authorized ETag.

Translate known unique/FK/check/domain failures using SQLSTATE, constraint identity
and operation context. Several SQL guards share 23514 and have no distinct
constraint name: perform explicit domain checks for actionable errors, and map
remaining known guards through a reviewed allowlist. Never return arbitrary SQL
exception text. Unknown invariant failure is a safe 500, not a guessed success or
generic 409 masking a programming error. Roll back before any follow-up query.

Static allOf/anyOf uses current dependencies. Stateful checks include conditional
cash receipt authority, nonzero-count adjustment authority, kind-scoped history,
per-section dashboard and query-type chatbot reads. Apply grants before returning
replayed results too; a previously successful action is not an authorization bypass.

Allow If-Match, If-None-Match and Idempotency-Key through CORS. Expose ETag,
Location and Content-Disposition as well as request/auth/retry headers. Provider
signature headers are server-to-server and do not become a browser signing flow.

### Pagination and read consistency

Use a sort registry per operation, bound filters and keyset predicates. Append a
unique tie-breaker in the same direction; ledger order is date/order/id, independent
of descending display. Encode a versioned, signed opaque cursor containing typed
last keys and a hash of operation/resource/filter/sort/authorized-kind scope.
Reject malformed, tampered or different-scope cursors with 400 INVALID_CURSOR.
Recheck current permissions on each request; never encode grants as authority.

Default limit 25, maximum 100; fetch limit+1 and return source pagination. Literal
substring search escapes SQL LIKE wildcard characters while binding the value.
Do not add arbitrary text-length business limits absent from the source contract.

Totals, page and asOf within one response must share one database snapshot. Prefer
a single SQL statement/CTE; if multiple queries are required use a dedicated
read-only repeatable-read transaction with fresh authorization for that read.
The normal READ COMMITTED request session's auth SELECT may already have begun a
transaction, so isolation cannot be changed halfway through it. Independent page
requests are not promised a historical snapshot: mutable sort keys can move when
business data changes, and the UI must be able to restart a list.

### ETags

Use a strong opaque hash of the canonical authorized detail representation plus
resource identity and format version. Include child content and joined fields
that actually appear in that representation. Do not use parent updatedAt alone:
line edits, reservations and balances can change detail without changing it.

Acquire the owning aggregate lock, reload the projection and compare If-Match in
the mutation transaction. All writers of draft children serialize through the
same parent. For a line operation, the returned ETag belongs to its document/count
detail, as explicitly defined by the API. Mutation-result wrappers similarly
return the owning resource token. Materialize it from the same post-write snapshot.
Returning to a byte-identical representation may legitimately yield the same
strong ETag; business-state rules are still rechecked under locks.

## 4. Durable idempotency

Domain UNIQUE keys prevent some duplicate effects but do not implement actor/
operation/resource scoping, payload-conflict detection or stable retry results.
Use a persisted command registry rather than an in-memory response cache.

Proposed record fields: generated UUID identity, actor ID, operation ID, canonical
resource scope, client UUID, request fingerprint, domain/recovery references,
completion state, safe result/status/ETag/Location, createdAt/updatedAt. Unique on
`(actorId, operationId, resourceScope, clientKey)`. Auth credentials and webhooks
do not enter this registry; webhook uniqueness remains paymentId/eventKey.

Protocol for a local mutation:

1. Authenticate, authorize, validate syntax and canonicalize business payload.
2. Claim the scoped key in the caller transaction before domain locks. A competing
   insert waits for the first transaction; reselect after conflict/rollback safely.
3. A different fingerprint returns 409 IDEMPOTENCY_KEY_REUSED. Missing fields and
   explicit null remain semantically distinct; materialize defaults consistently.
4. A completed matching command returns its committed result even if the original
   If-Match is now stale. Authentication/current grants and original conditional
   permission requirements still apply. Do not re-execute the mutation.
5. For a new command, compare current preconditions, execute the workflow, flush,
   force deferred checks, read final projections and write completion metadata.
6. Commit business state and command together, then return. A definite failure
   rolls back both. An ambiguous connection failure requires looking up that same
   key on retry, never assuming rollback and issuing a new business intent.

The fingerprint covers operation, resource and normalized business payload/query;
transport request IDs and ETags are not new business intents. Save original
preconditions separately for diagnostics. Replays use a new request correlation
header; they do not append a second business audit event. Result storage uses a
source-specific safe projection, not the raw request, credentials or SQL errors.

Existing globally unique creation/batch/payment UUID columns receive **internal**
keys derived from the durable command ID and named substep, not the bare client
UUID. This allows equal client UUIDs in different actors/scopes and distinct keys
for issue, auto receipt and replay batches in one command.

Persisted provider workflows have two boundaries: TX1 accepts/links the domain
resource and recovery record; provider work happens outside locks; TX2 records
verified outcome. Matching retries recover/poll/reconcile that resource. They do
not stay forever at an obsolete cached PENDING response or create a new transfer.
Retain financial command identity for the evidence lifetime; no generic short TTL
that permits an old money action to run again after registry cleanup.

## 5. Shared write protocol and locks

1. Use the request session's current transaction; do not blindly nest `begin()`
   after principal queries. A top-level transaction runner owns commit/rollback.
2. Set validated actor/request/function with transaction-local `set_config`.
   Function code comes from the use case, never request JSON. Preserve auth's
   default users.manage while accepting an explicit validated business code.
3. Discover involved IDs without authorizing from stale reads. Acquire common
   locks in a documented order and then reload state with populate_existing.
4. Recheck resource existence/kind, current grants where needed, ETag, state,
   quantities, references, limits and money evidence after any lock wait.
5. Append revisions/batches/ledgers and update legal state links. Keep deferred
   constraints deferred until the whole composed workflow is structurally valid.
6. Flush, `SET CONSTRAINTS ALL IMMEDIATE`, reload derived caches, construct and
   validate response DTO and idempotency result, then commit. No lazy ORM access
   or first-time response validation after successful commit.
7. Definite error rolls back all business/audit/retry rows. Retry only bounded
   full transactions for 40P01/40001, using the same intent and fresh reads. Unknown
   commit outcome is resolved by durable key lookup, not automatic blind replay.

### Lock plan

The database already takes locks inside triggers. Include them in tests; an
application-only ordering chart does not prove the absence of deadlocks.

- Rules/type/district and master unit/product rows needed for the action precede
  agency/balance and inventory balance locks. Sort IDs within each set.
- Agency identity/profile and balance are coordinated for type/termination/posting.
  Ledger triggers take agency_type before agency_balance: pre-acquire type locks.
- Inventory balances are ordered by productId, then source/target document and
  revision locks by ID, then lots and payment/confirmation/attempt records.
- Count workflows acquire affected inventory balances before the count/header
  update; count-line and confirmation triggers also lock their parent/balances.
- Administrative group assignment/deletion uses a consistent group/user/token
  protocol; auth token mutation retains user-before-token ordering. Do not use a
  global “lock every acting user” mechanism for ordinary business requests.
- If a reread reveals a new dependency outside the acquired lock set, restart
  discovery/transaction instead of acquiring a lower-order lock opportunistically.

For M13/M16/M22/M29, write the exact statement/trigger lock sequence in the child
DESIGN and prove opposing workflows with barriers, bounded lock timeouts and
independent connections. The current global business-rule lock on agency edits
is a known contention point to measure, not silently remove.

## 6. Document and inventory primitives

- Stable document ID/code/agency/origin; one current revision; revisions start
  DRAFT. A revision/line from another parent returns 404.
- Goods lines dispatch by one of four kinds; financial documents have no lines.
  One product per revision; lineNo allocation under parent lock; compute totals
  before validating immediatePayment. Deleting the last line may leave an empty
  draft only when immediatePayment is zero.
- Draft snapshot names are prepared from masters; receipt snapshots are finalized
  before post; issue prices/contact/rate/limit freeze at READY. READY content is
  immutable. Posting checks current operational eligibility but keeps agreed price.
- Source document sets original businessOrder once. Auto-receipt ledger effects
  use the issue's date/order even though the receipt has its own document identity.
- Append POST/REVERSE/REALLOCATE batches; reverse only still-effective originals,
  never a reversal. Preserve original effective date/order and exact negative value.
- Latest purchase-price source is a current POSTED receipt ordered by businessDate,
  original businessOrder and document ID; an adjustment/return is not a price source.
- Inventory/statement balances aggregate the entire atomic date/order checkpoint
  before page filtering. Reversal flags and opening/closing totals are separate
  from displayed page rows; same-day issue/cash is never shown as intermediate debt.

## 7. Settlement, provenance and chronological replay

### Allocation engine

Represent each source event as an explicit typed input: agency, effective date/
order, source document/revision, kind, exact amount and permitted excess policy.
Read eligible current invoices with balance **at that event**, not current total
debt. Order by original invoice date/order with stable identity tie-breaker.
Allocate deterministically until exhausted; automatic receipts target only their
own invoice. Manual debt receipts and credit applications require full allocation;
online and separated upfront cash split remainder into credit.

Credit lots retain originReceiptId across every consumption/return chain. Pair
ordered credit debits with ordered invoice allocations deterministically within
the same posting source; reconstruct the per-invoice cash provenance when a later
return creates credit. Prove conservation for multiple lots, invoices and repeated
return/application chains. If ledger legs cannot uniquely reconstruct this pairing,
add a reviewed explicit provenance association before claiming support (D08).

### Backdated new postings already need replay

M16 provides a timeline/replay seam for supported kinds. A new backdated charge or
receipt can change the correct allocation of a later untouched receipt. Merely
appending the new entry and letting SQL reject an otherwise valid history does
not implement the target behavior. M18/M19 must exercise those cases. M23 extends
the engine to return rounding/splits/provenance; M25/M27 add credit/refund blockers.

Maintain a persisted-kind capability register separately from enabled HTTP routes.
Existing seeded later kinds count as dependencies immediately. D17 holds a writer's
publication until every relevant replay handler/blocker passes; partial internal
tests on a simpler history do not establish general backdated-write support.

Start at the earliest affected old/new business checkpoint and identify all later
sources whose allocations, return split or credit availability can change. Replay
under agency/source locks, retaining original cash amounts/dates and terminal
evidence. For changed allocations, reverse active legs and append replacements
under the source's revision/batch semantics. For changed immutable return line
amounts, use a new dependent revision with explicit system-generated replay reason;
never update a POSTED line. Reconcile this protocol against SQL before M23 closes.

### Cross-document corrections in M29

M29 adds full dependency discovery, replacement/cancellation orchestration and
all public correction branches; it builds on the earlier chronological engine.

1. Load old/current source and requested full replacement; derive changed dates,
   quantities/prices and affected products/agencies/invoices/returns/lots/refunds.
2. Lock/reload the dependency closure; enforce source-specific authority and guards.
3. Plan old reversals, replacement effects and downstream replay deterministically.
4. Preserve received cash: auto receipt follows a valid corrected issue; cancellation
   separates confirmed upfront money into a full RECEIVED_UNAPPLIED receipt.
5. Preserve immutable paid refunds/count evidence and active reservations. Reject
   when a valid replay cannot retain their exact provenance/available source.
6. Apply all effects/revisions/audit in one transaction; force final historical
   checks and current limits; return only after commit.

Correction of an erroneous businessDate may move the source to its corrected
period: reversals remain at the old date, replacement uses the corrected date.
“Original-period correction” means never using the edit timestamp as a new sale.
Real returns/refunds remain new events at their actual dates.

## 8. Counts and refund ordering

For counts, capture currentStock and max inventory_entry ID atomically under the
same stock locks, retaining every observed line. On confirmation, validate both
snapshot fields before writing the adjustment's own ledger entries. Create the
adjustment draft/link, mark count CONFIRMED while the old snapshot is still current,
then post the adjustment and force deferred checks in the same transaction.
Otherwise the adjustment's own movement can make the count appear stale. No
intermediate commit; all-zero counts have no adjustment.

Refund submit reserves same-source credit but leaves document/revision DRAFT.
API guards additionally freeze editable content while reserved/in flight. Manual
paid confirmation derives date from paidAt and stores evidence before posting.
Online attempt creation commits PENDING before sending; timeout becomes UNKNOWN
with ACTIVE reserves. Definitive failure releases; success debits/consumes/posts
once. Retrying a verified FAILED attempt creates a new DRAFT revision/reservation/
attempt, even if content is unchanged; old evidence is never reactivated.

## 9. Sandbox integration and crash recovery

Define adapter operations `create_checkout`, `query_payment`, `request_refund`,
`query_refund` and raw-byte `verify_webhook`. HTTPX moves to runtime dependencies
when used. Use explicit connect/read/total deadlines and typed sanitized failures.
No network or mail call occurs while domain row locks are held.

The contract's webhook HMAC is fixed: SHA-256 lowercase hex over UTF-8 timestamp,
dot, raw body; key selected by configured key ID; ±300-second window; constant-time
comparison before JSON parsing. Provider/path/reference/amount must match the
persisted resource. Store only the allowed business evidence projection and a
canonical event fingerprint; duplicate same event returns duplicate=true, different
payload under that key conflicts. No 200 acknowledgement before commit.

Persist transport metadata for restart-safe setup and dispatch: one row linked by
real FK to payment or refund attempt, initiating actor, stable provider key,
checkout URL/expiry where applicable and bounded claim/recovery metadata. It does
not replace domain money states or store signatures/provider secrets. Refund
posting requires an identified postedBy in current SQL: retain the authorized
initiating poster for asynchronous completion, with SYSTEM audit for the external
event; do not attribute it arbitrarily to the preparer or invent a user.

Crash matrix: before TX1 no operation; after TX1 resume same key; provider accepted
but response lost query same reference; after TX2 commit but response lost return
persisted outcome. A recovery CLI/scheduled invocation may claim pending work in
short transactions; it shares the same service protocol. Required employee
reconcile endpoints remain available. No dependency on an unrequested broker.

## 10. Reporting, printing and chatbot

Reports use existing sales/debt functions where semantics match, supplemented by
inventory/product/cash-credit queries. Compute full filtered totals and company
gross denominator before paging; do not cast aggregate money to storage bounds.
Use the same snapshot/query model for JSON and full-filter exports. Keep quantities
in their own units and current reservation amounts separate from historical closes.

Proposed renderers: autoescaped Jinja2 HTML, ReportLab PDF with a bundled licensed
Vietnamese-capable font, and XlsxWriter XLSX. Install only in the owning slice with
locked versions and container tests. Both PDF and HTML consume one snapshot model;
verify actual rendered text/page layout. Preserve exact long IDs/money in XLSX as
explicit text where spreadsheet numeric precision is insufficient; disable formula
and URL interpretation of untrusted cell strings. Exports never silently truncate.

Build dashboard sections only after permission checks; reuse read services, not
report HTTP handlers that impose reports.read on a sales.read-only dashboard user.
Resolve D09's admission/section discrepancy first. Monthly trend window and tie
ordering must be explicit in the child plan.

The chatbot's queryType is already explicit. Start with deterministic supported
Vietnamese intent/entity extraction, agency-code lookup, structured product/date
inputs and NEEDS_CLARIFICATION. Reuse authorized readers and return the source
tagged union. An external LLM is not necessary to satisfy this contract and must
never become an SQL/authorization authority. Resolve candidate paging D10 before
claiming complete duplicate-name support.
