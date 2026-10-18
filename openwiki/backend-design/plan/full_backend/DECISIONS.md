# Gap and decision register

**Prepared:** 2026-10-02 from source inspection. “Observed” here means static
source evidence, not a newly reproduced live failure. Every proposed repair needs
its owning implementation tests. Open contract/product decisions are explicitly
distinguished from engineering choices that can proceed.

**Implementation checkpoint 2026-10-03:** M02 locally resolves shared engineering
D01/D03/D04/D05/D11/D12/D14 foundations; exact choice and passing evidence are in
[shared DESIGN](../shared_api/DESIGN.md) and [VERIFICATION](../shared_api/VERIFICATION.md).
Cursor signing is purpose-derived from AUTH_SIGNING_KEY; source head is0004 with an
explicit infrastructure manifest. Later owning resource/aggregate/audit/report gates
still reverify these interfaces. Open business/provider/contract decisions below
retain their due-module gates, particularly D02/D07/D09/D10/D15/D16/D17.

**Checkpoint 2026-10-04:** M04/M07–M09 locally complete at source head0005.
Recorded-unit first-use policy race reproduced and repaired additively; [evidence](../units/VERIFICATION.md).
New resource cursors use anchor-v2 original-sort digests and reject mutated anchors.
Remaining business/provider/contract decisions retain the gates below.

## D01 — Durable HTTP intent identity

**Observed:** [0001](../../../../backend/alembic/sql/0001_initial.sql) has global
document creationKey and posting/payment/refund keys, but no actor/operation/
resource/payload registry. Several keyed operations (terminate, submit, count,
verification, reconciliation) cannot recover via those columns alone.

**Plan:** M02 adds a scoped durable registry and internal substep UUIDs, with
transactional result/recovery metadata. No generic application-memory cache.
**Gate:** same key/same payload concurrent requests, changed payload, different
actor/resource, restart, rollback and unknown-commit recovery. Before M12's first
public keyed action; M26 extends accepted-command recovery across provider TX1/TX2.

## D02 — Unused agency/product deletion is currently blocked

**Resolution 2026-10-04:** reviewed0006 guards eligible owner removal and permits
only nested zero-cache cascade after parent absence; all business FKs remain
RESTRICT and direct cache mutations remain denied. Both0005 failures, rollback,
both reference/delete orders, history/identity and fresh/populated seed gates pass.
See [products](../products/VERIFICATION.md), [agencies](../agencies/VERIFICATION.md).
The observed defect and selected repair below are retained as decision history.

**Observed:** caches are inserted automatically; their owner FKs are RESTRICT.
`protect_balance` rejects DELETE unconditionally. The target's `deleteAgency`
and `deleteProduct` promise eligible deletion plus zero-cache cleanup, so deleting
either cache first or parent first cannot fulfill the contract as written.

**Plan:** M11 owns a reviewed additive deletion repair shared with M12. Reproduce
unused-owner failure first. Prefer owner-delete guards plus cache FK cascade and
a narrowly constrained nested-delete allowance: require eligible owner removal,
zero cache/source state and absence of business references. Direct cache DELETE/
UPDATE remains forbidden. Parent deletion must remain blocked by all transaction,
count, payment and historical references; never disable triggers or constraints.
**Gate:** successful unused-owner delete; used/zero-net-but-historical rejection;
concurrent reference insertion vs delete; rollback; direct cache delete rejection;
audit retained and generated IDs never reused. Validate actual PostgreSQL cascade
trigger ordering in the migration tests rather than assuming it.

## D03 — Parent ETags need aggregate content

**Observed:** timestamps are per row. Document-line and count-line changes do not
automatically change every parent timestamp; refund reservation/attempt and joined
balance values also change detail representations independently.

**Plan:** M02 provides canonical strong hashing; each resource supplies its complete
detail projection. M13/M22 serialize all child writers via the parent and compare
the same parent representation under locks. Do not use second-resolution or
parent-only updatedAt as a universal version. **Gate:** child-only edit invalidates
old token, same-total line replacement, same-stock intervening movement, changed
reservation, joined master changes, two competing edits and stale idempotent replay.

## D04 — Seed/verifier assumptions must evolve with schema

**Observed:** [seed.main](../../../../backend/app/db/seed.py) requires exact 0003;
[check_database](../../../../backend/app/db/verify.py) compares exactly 29 tables/
58 timestamps and seeded mode requires every table nonempty. `run_regression`
recreates 0001 only. A new retry/dispatch table breaks these assumptions.

**Plan:** M02 makes seed require the expected current compatible migration head
using reviewed migration metadata, retains its demo marker and no-reset behavior,
and distinguishes an explicit domain manifest from infrastructure tables. Later
revisions update the manifest deliberately. Preserve baseline 54 checks and add
head-migration tests; do not claim the old regression validates new DDL.
**Gate:** seed twice at new head, populated 0003 upgrade, zero valid command rows,
unexpected/missing table rejection and unchanged historical passwords/documents.

## D05 — Business audit/error/CORS infrastructure is auth-scoped

**Observed:** [request_context](../../../../backend/app/core/request_context.py)
hard-codes users.manage in audit and applies media/limiting/error protection only
to auth paths. [main](../../../../backend/app/main.py) lacks business allow/expose
headers; non-auth validation uses default error bodies.

**Plan:** M02 extends the existing plumbing with explicit function context and
source-safe errors, operation-aware JSON checks, headers and limiter interfaces.
Preserve auth privacy/health payloads and the one-worker deployment limitation.
**Gate:** direct/proxy/cross-origin headers, user/system audit attribution and
context rollback/isolation, safe admin password validation, retained auth coverage.

## D06 — Chronological replay cannot wait entirely for M29

**M23 checkpoint2026-10-18:** actual return-line cumulative rounding and immutable
dependent successors now exist. Real backdated1→0-VND replacement and protected
reserved/paid-source cases pass; [owning evidence](../sales_returns/VERIFICATION.md).
Full posted correction/cancel orchestration stays M29.

**M16 evidence2026-10-11:** internal chronological financial replay passed, including
valid insertion before existing credit/return/paid-refund effects; [evidence](../settlement_core/VERIFICATION.md).
M23 line rounding/dependent revisions and M29 correction orchestration remain open.

**Observed:** `assert_agency` rechecks later sources on backdated ledger inserts;
`assert_document` enforces invoice FIFO and cumulative return rounding. SQL checks
the result but does not build replacement allocations. M18 can encounter this
before correction endpoints exist, including on the populated demo.

**Plan:** M16 implements chronological allocation/replay for supported kinds;
M23 adds return rounding/split/provenance and immutable dependent-revision handling.
M29 later exposes full cross-document corrections and broadens the dependency
closure. **Gate:** a valid backdated receipt/issue succeeds with correct later FIFO;
invalid histories roll back; an earlier partial return can change a later return's
rounded amount without modifying a POSTED line. Rerun earlier writers as each new
consumer enters. No hidden blanket ban on backdated valid source requests.

## D07 — Sandbox provider and recovery implementation

**Observed:** no adapter/configured external provider; checkoutUrl is an API
projection with no persisted setup store; seed evidence is simulated. The target
defines a normalized HMAC envelope, not a named provider's native webhook protocol.

**Engineering plan:** M26 uses a typed adapter and durable transport metadata;
develop real HTTP integration against a separately running controlled sandbox
fixture, including lost responses/restart/reconcile. Promote HTTPX to runtime when
used. M27 retains the authorized posting actor for asynchronous refund completion.

**Open environment decision, due before full M26/M27:** identify the deployed
sandbox service/provider, credentials, reachable callback URL and native-to-envelope
translation (if applicable). A test fixture demonstrates transport/state behavior;
it is not evidence of a named external provider deployment. Record which sandbox
is accepted for course delivery before closing that release gate.

## D08 — Exact cash provenance through credit applications

**M16 evidence2026-10-11:** conserved ordered pairing and repeatable lot ordering,
protected per-lot/receipt/future-return minima pass pure and real-PG regressions;
no provenance-association migration was needed for this internal financial seam.
Later M23/M25 actual writer and correction gates remain open; [evidence](../settlement_core/VERIFICATION.md).

**Observed:** credit_lot preserves originReceiptId; credit_entry debits and
receivable_entry invoice allocations share source batches but have no direct
lot-to-invoice allocation edge. SQL explicitly leaves provenance choice to services.

**Plan:** M16 specifies a deterministic ordered sweep pairing consumed lots with
invoice allocation legs, retaining the original cash receipt through repeated
application/return chains. Document source-order tie breaking and reconstruction
from immutable entries. If existing legs cannot uniquely preserve required
provenance, add a real-FK association via reviewed migration before M23/M25; do not
substitute “any same-agency receipt.” **Gate:** multi-lot/multi-invoice conservation,
reapplication followed by return, refund to the correct original online payment,
and correction invalidating a reserved/paid source.

## D09 — Dashboard admission disagrees with section permissions

**Observed:** `getDashboard.x-permissions.anyOf` includes stock.issue.post and
cash.upfront.verify, but not stock.issue.prepare/cash.receipt.post. The response
schema permits pendingIssueCount to prepare-only and verifiedUnreceiptedAmount to
cash.receipt.post-only users. These valid section readers could fail route admission.

**Proposed contract resolution:** use the union of all documented section readers
for admission and retain per-section projection checks. **Status:** requires a
target-contract decision/update before M31, not silently implemented here. If the
product intends stricter admission instead, revise the schema descriptions and UI
mapping explicitly. Test each permission in isolation and the no-permission case.

## D10 — Chatbot candidate pagination has no safe continuation

**Observed:** ChatbotSelection describes paging >25 matches through GET /agencies.
Chatbot accepts debt.read/sales.read by query type, while /agencies requires
agency.read/manage and its response includes contact/balance fields. The chatbot
request has no cursor, so its minimal candidate list cannot currently continue
for every permitted chatbot-only user.

**Proposed contract resolution:** add candidate-only continuation to the chatbot
request/response under the same query-type permission, with a signed scope-bound
cursor and minimal code/name/district projection. Keep the agency profile API's
existing grants. **Status:** decide and update the single source contract before
M32; do not widen agency access or invent an invisible pagination input. Test
26+ duplicate-name candidates, changed question/cursor and no financial disclosure.
Also revise `ChatbotSelection.candidates.minItems=2` for continuation: a final
page can contain one candidate, or zero after concurrent deletion. A one-item page
does not resolve an originally ambiguous question automatically.

## D11 — Body parsing for signed webhooks and empty actions

**Observed:** auth's middleware requires JSON for all auth POST/PUT, whose source
operations have bodies. Business post/submit/reconcile operations often have no
requestBody, and webhook signatures must be checked against raw bytes first.

**Plan:** M02 makes media validation operation-aware. Bodyless actions must work
without a JSON Content-Type; webhook code verifies bytes before parsing. Missing
If-Match is 428 where specified, not default 422. **Gate:** source-wide requestBody/
header matrix and signature verification before any domain write.

## D12 — Timestamp, numeric and audit projections

**Observed:** PostgreSQL JSON audit snapshots contain native numbers, while the
business HTTP contract represents exact money/BIGINT IDs as strings. The UI roadmap
also broadly says IDs are strings, although CatalogId is explicitly integer.

**Plan:** M02 exact-value types distinguish domains/aggregates; M06 projects audit
JSON according to entity fields without converting arbitrary numeric-looking text.
Update frontend planning wording for CatalogId. Include near-limit IDs, large
aggregate sums and Vietnam midnight. **Gate:** no float path or lossy JSON parsing
for audit numeric data; parse JSON numerics to exact types where necessary.

## D13 — Publication of partially implemented operations

**Observed:** the roadmap splits draft versus posted cancellation and zero-upfront
versus money-dependent posting under the same target operation ID.

**Plan:** inventory first/full gates explicitly. Keep incomplete state branches in
internal service/test slices until publication supports the entire target operation,
or make a separately reviewed, explicitly partial release contract. A valid request
must not get a fabricated successful placeholder. Runtime docs and UI readiness
use the full published scope. **Gate:** release manifest matches actual handlers
and no deferred source branch is silently marked complete.

## D14 — Stored-value limits are not report aggregate limits

**M24 checkpoint2026-10-18:** real isolated credit history reproduces1.2e18 with
current7e17 after backdated6e17 cash and later5e17 payout. Canonical CreditEntry
balanceAfter and CreditStatement opening/closing now use AggregateMoney, matching
M20 debt. Current/stored/lot bounds remain unchanged; [evidence](../agency_credit/VERIFICATION.md).

**M20 resolution2026-10-17:** real Supabase isolated-schema test reproduces two6e17
issues with an intervening later5e17receipt: current debt7e17, historical debt1.2e18.
ReceivableEntry.balanceAfter and ReceivableStatement.openingDebt/closingDebt now use
AggregateMoney in the canonical contract and runtime. Current/invoice/stored Money
is unchanged. `test_review_regressions::test_historical_debt_exceeds_stored_money_and_overflow_is_a_business_conflict`
passes persisted-state and canonical-schema assertions; unrepresentable final current
balances return409/BALANCE_OVERFLOW with atomic rollback.

**Observed:** the target defines AggregateMoney/Quantity without the single-row
upper bound; sales ratios use company gross before agency/page filters.

**Plan:** M02 serializers and M30 queries/renderers preserve arbitrary aggregate
precision and full-filter totals; large XLSX numerics are emitted exactly with
documented cell types. **Gate:** totals >10^18, duplicate agency names, returns-only
month, filtered company denominator and export beyond 100 rows.

**M14 resolution 2026-10-05:** real PostgreSQL reproduces receipts600000000000000
and an issue500000000000000, followed by a backdated second receipt600000000000000.
Current stock700000000000000 fits quantity_value, but historical stock1200000000000000
does not fit the original statement Quantity response. InventoryStatement opening/
closing and InventoryEntry.balanceAfter now reuse AggregateQuantity; line deltas
and stored/current quantities remain bounded. No DDL change, clamping or float.
Regression: `test_inventory::test_valid_backdated_receipt_can_make_historical_stock_wider_than_stored_stock`.

## D15 — Historical snapshot and evidence policies need explicit edge tests

**M22/M23 checkpoint2026-10-18:** counts confirm/link before their adjustment movement.
Return-rounding successors preserve historical agency/line snapshots. Concrete0006
protected-lot failure is repaired by reviewed0007: current POSTED same-return
successors may replenish the original immutable lots. Reserved and paid evidence,
cash receipt origins and superseded posted content stay unchanged. Fresh/populated
upgrade, repeated seed,54SQLchecks and downgrade/re-upgrade pass. M29's inactive-master
posted-correction policies remain separately gated; see [M23 evidence](../sales_returns/VERIFICATION.md).

**Observed:** guard_line requires a positive unitPrice even for a draft issue;
new products have zero purchase price. Count confirmation checks the last ledger
entry before its own adjustment; posted refunds require an identified actor.

**Plan:** document_core rejects unpriced issue lines consistently with source
purchase-price conflict semantics (empty issue drafts remain valid). M22 follows
the count/link/post ordering in DESIGN. M27 persists the authorized initiating
poster across recovery. Check corrections against inactive masters/terminated
agencies and existing return-price FKs in their child plan; where selected business
behavior conflicts with SQL, reproduce and resolve before claiming completion.
**Gate:** no direct cache/immutable-row mutation to make tests pass.

## D16 — Derived selling price can exceed the response Money range

**Resolution 2026-10-04:** canonical DerivedSellingPrice is an unbounded nonnegative
integer string for Product/InventoryChange.currentSellingPrice. Real persisted
large and rounded-zero witnesses pass. Stored unit prices/totals retain their
Money bounds; common.prices.stored_selling_price gives409 SELLING_PRICE_UNUSABLE
before later issue/line writers persist unusable quotes. No clamping. See
[rules](../business_rules/VERIFICATION.md), [products](../products/VERIFICATION.md).
The original assessment below is retained as history; the publication decision
and source update are complete. Later M13/M17/M29 consumers must preserve it.

**Observed:** `money_vnd` and source Money accept purchase price
`600000000000000000`; source PriceRate and SQL accept rate `2`. A receipt of one
unit has a valid stored line/total. `inventory_overview` calculates selling price
`1200000000000000000` without a money-domain cast. `Product.currentSellingPrice`
and `InventoryChange.currentSellingPrice` reference Money, which cannot serialize
that value. A valid rate change or receipt posting can therefore produce a state
that product GET or a mutation result cannot represent. A small positive source
price/rate can also round to zero, while issue `guard_line` requires price >0.

**Recommended contract resolution:** distinguish an exact, nonnegative derived
quote from a storable document unit price. Widen only the derived selling-price
response fields using a clearly named string schema; retain existing Money bounds
for stored prices/line totals and require a positive representable issue price
before saving/finalizing an issue line. Preserve ordinary product reads even when
the current quote cannot be used for a sale. Document the domain error/status for
that case in create/line/submit operations. Never clamp, wrap or substitute zero.

**Original status (resolved above):** source-contract decision/update required before M10/M11 price consumers
are published; apply to M15/M17/M29 mutation results and M32's Product projection.
If the chosen policy instead bounds all catalogue quotes, explicitly specify the
new cross-product checks, current-state migration and locking for rule changes,
receipt posting and source-price corrections. Do not silently add a narrower
request range than the current target.

**Gate:** near-limit purchase × rate, derived zero, rate change racing receipt
posting, corrected source price and all affected response schemas. M02 supplies
exact arithmetic; a static arithmetic witness is not persisted-state proof.

## D17 — Persisted future kinds and release readiness

**M16 evidence2026-10-11:** executable financial `CAPABILITIES` register and full-seed
immutable-evidence replay verified. No new financial writer is published through
this internal gate; each later owning writer retains its publication obligation.

**Observed:** demo v1 already includes returns, credit applications, refund
reservations and terminal refunds. `assert_agency` revisits later POSTED sources
on backdated writes. M16's initially supported replay handlers therefore cannot
assume later kinds are absent just because their HTTP modules are not implemented.
Likewise, M15 draft creation does not deliver line editing: the shared line
operation's complete dispatcher is gated at M28.

**Engineering decision:** retain the acyclic implementation order and explicitly
separate slice verification, complete operation support and deployment readiness.
Each writer records the persisted kinds it can read/replay/protect. Publish only
after the relevant dependency closure is supported on the intended database;
otherwise keep that route in isolated internal integration. Bring required replay
handlers forward or wait for the owning later slices. Never reject a valid business
request with an invented unsupported-history conflict, erase fixtures, or use a
baseline SQL rejection as proof that valid replay is implemented.

**Owners:** M16 maintains the register; M17–M19/M23/M25–M27 extend and regression-test
it; M29 closes correction orchestration. The [execution release map](EXECUTION.md)
uses R3/R4 as engineering milestones and R5 as the complete operational-workflow
handoff. First/Full labels alone are insufficient for frontend live readiness.

**Gate:** backdated issue/receipt/upfront insertion before existing return/credit/
refund fixtures; correct replay or a genuine business-invariant conflict; unchanged
real-money evidence; no undeclared valid branch missing from a published handler.
