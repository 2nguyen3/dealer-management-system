# Implementation work packages — M01 through M32

**Status:** declared slices through M24 are verified; M15/M17/M18/M21/M23 retain
their M29 full posted-operation gates. Next code M25. Prerequisites match the
[General Plan](../../GENERAL_PLAN.md). Operation IDs and first/full gates are in
[OPERATIONS](OPERATIONS.md); do not infer scope from a package name.

Each package inherits [DESIGN](DESIGN.md), the common [TESTS](TESTS.md) gate,
exact source permission/schema/header/error definitions and a **100% scoped
statement/branch gate for newly owned behavioral code**. Proposed symbols below
identify responsibilities, not implemented functions. Before closing code, the
owning child TESTS must list every actual helper/method/validator/dependency/route,
including new symbols, and map success/failure/boundary cases to exact test nodes.
Every mutation requires real persisted-state/rollback evidence.
Use [EXECUTION](EXECUTION.md) for delivery packets and release bundles. A passed
internal slice does not publish an operation whose state branches, persisted-kind
dependencies or required consumer actions remain unsupported (D17).

## M01 — authentication

**Prerequisites:** existing infrastructure. **State:** implemented, prior local
evidence in the [auth package](../authentication/PLAN.md).

- Reuse the five ORM mappings, Principal, require_permissions, current-grant reads,
  password helpers and invalidate_user_sessions. Seven source operations exist.
- Preserve refresh lineage, absolute expiry, current authVersion and credential-safe
  errors while extracting shared business infrastructure.
- M04 integrates real administration writers into the invalidation seam; permission
  edits in M05 affect next request without a new JWT or unconditional manager bypass.
- Regression: old/new session behavior after group/status/reset, error redaction,
  real TLS transport, request context and direct/proxy limiter behavior.
- Operational gate: configure signing key, explicit 0003 deployment, sender/TLS/reset
  URL; frontend reset page is a separate consumer dependency.

## M02 — shared_api

**Prerequisites:** M01. **Effort:** high. **Detailed child:**
[shared_api](../shared_api/PLAN.md). **Gaps:** D01, D03–D05, D11–D12, D14.

1. Extend existing error/request/audit infrastructure; introduce strict numeric/date
   aliases, keyset/sort, strong precondition and durable command interfaces.
2. Add reviewed command-registry migration, head-compatible seed/verifier handling
   and a reusable isolated PostgreSQL/contract harness.
3. Verify bodyless actions, 428 versus 422, source Error and business CORS headers.
4. Prove duplicate intent, different payload/scope, stale ETags, rollback and recovery.

**Exit:** helpers work through test-only representative routes and real database
transactions; auth remains passing; no business operation is falsely mounted.
M03 is the first real catalogue integration of these helpers.

## M03 — user_groups

**Prerequisites:** M02. **Effort:** medium. **Storage:** existing UserGroup and
GroupPermission/AppUser references. **Proposed service:** GroupService.

- Implement five operations, with keyset q/code/sort and userCount including LOCKED.
  New groups receive no implicit grants. Preserve source code/name uniqueness.
- Reads accept groups.manage OR users.manage OR permissions.manage; create/update
  require groups.manage; deletion requires groups.manage AND permissions.manage.
- For deletion, lock the group, check all users, delete eligible grants then group
  atomically with audit. FK integrity is the final concurrent-assignment guard.
- Invalid grant cleanup must roll back group and audit together. Return 409 for
  references, 412 for stale ETag, 204 empty for successful deletion.
- Tests: no-user success; one LOCKED user blocks; grant-only group cleans up;
  duplicate code/name; same code with different case follows actual DB semantics;
  assignment vs delete and two stale updates. Check resulting /auth/me grants.

**Exit:** all five HTTP operations and actual-symbol tests; M04 integration reruns
the assignment/delete race with its real writer.

## M04 — users

**Current evidence:** [owning child](../users/PLAN.md), [verification](../users/VERIFICATION.md); five operations locally complete.

**Prerequisites:** M03. **Effort:** medium. **Storage:** reuse AppUser/AuthToken.
**Proposed service:** UserAdministrationService.

- Five operations: list/create/detail/patch/admin password reset; no user DELETE.
  All require users.manage, use source User projections and ETags.
- Create hashes the supplied nonempty password; permits source ACTIVE/LOCKED state,
  validates group, and uses lower(email) uniqueness without leaking hashes.
- Update uses a field allowlist; password cannot be patched here. Group/status
  changes flush the trigger's authVersion bump then call invalidate_user_sessions
  in the same transaction. Profile-only changes do not invent session invalidation.
- Reset uses the same hashing/invalidation path; no implicit unlock or token issuance.
  Coordinate group/user/token locks with auth's user-before-token protocol.
- Tests: mixed-case duplicate email race, missing group, one-character/space password,
  reset locked user, rollback restores tokens/hash/audit, simultaneous refresh/login
  versus real administrative update, stale ETag and safe validation/errors.

**Exit:** actual admin HTTP operations prove immediate session effects; existing
auth concurrency/coverage remains valid.

## M05 — permissions

**Current:** full local completion; [plan](../permissions/PLAN.md), [evidence](../permissions/VERIFICATION.md).

**Prerequisites:** M03, M04. **Effort:** medium. **Proposed service:** PermissionService.

- Expose five source operations: read-only function list/detail, grant list/detail,
  and PUT set. Registry is the existing 33 function codes; no arbitrary CRUD.
- permissions.manage required throughout. Use If-None-Match:* only for creation,
  If-Match only for update; both headers invalid, neither gives 428, raced create 412.
- Serialize the group/function pair even before a grant row exists (group lock +
  unique pair guard). Store false to revoke; missing and false both deny.
- Safe projection joins code/name, preserves CatalogId versus BIGINT grant ID;
  read current grants, never a JWT-embedded or process-cached permission snapshot.
- Tests: absent→true→false, both preconditions, two creators/one winner, update versus
  next protected request, no MANAGEMENT bypass, deletion of owning group and rollback.

**Exit:** source preconditions and next-request authorization verified across groups.

## M06 — audit_logs

**Current:** full local completion; [plan](../audit_logs/PLAN.md), [evidence](../audit_logs/VERIFICATION.md).

**Prerequisites:** M05. **Effort:** medium. **Storage:** audit_log. **Proposed query:**
AuditQueries.list_entries/get_entry.

- Two audit.read-only endpoints with source actor/function/action/entity/request/
  created-time filters and time/id keyset order. No mutation routes.
- Correlate multi-row business operations through requestId and the actual function
  context from M02. USER and SYSTEM remain distinct; old/new nulls preserved.
- Project credential-redacted JSON with exact entity-aware numeric conversion;
  do not blindly stringify arbitrary note values or parse BIGINT/money via float.
- Tests: all filters combined, half-open time boundaries, timestamp ties and empty
  pages, source actor null, unknown ID, unauthorized reader, hash/password/token
  sentinels, immutable database audit and no audit from a rolled-back mutation.

**Exit:** source schemas and exact redaction/projection evidence; later writers
reuse these read assertions for their audit metadata.

## M07 — districts

**Current evidence:** [owning child](../districts/PLAN.md), [verification](../districts/VERIFICATION.md); five operations locally complete.

**Prerequisites:** M02. **Effort:** medium. **Storage:** district + business_rule +
agency aggregates. **Proposed service:** DistrictService.

- Five operations using Master requests, District response and allowed q/code/status/
  catalogue sort. Capacity is global rule minus ACTIVE count, never a district field.
- Reads accept district.manage OR agency.read OR agency.manage; writes district.manage.
- INACTIVE preserves existing agencies while prohibiting new ACTIVE assignments;
  deletion is blocked by any agency reference, including TERMINATED.
- Lock district/state changes consistently with agency admission; ETag includes
  visible activeAgencyCount/maxAgencies/remainingSlots.
- Tests: empty/full/inactive district, count excludes terminated, state change with
  existing active agencies succeeds, referenced delete fails, rule change affects
  capacity projection, stale token, duplicate code/name, assignment vs inactivation.

**Exit:** all five routes tested against existing seeded references and isolated races.

## M08 — agency_types

**Current evidence:** [owning child](../agency_types/PLAN.md), [verification](../agency_types/VERIFICATION.md); five operations locally complete.

**Prerequisites:** M02. **Effort:** medium. **Storage:** agency_type + agencies/balances.
**Proposed service:** AgencyTypeService.

- Five operations; read any agency_type.manage/agency.read/agency.manage, writes
  agency_type.manage. Exact maxDebt allows zero; counts include all/active separately.
- Type row lock precedes affected agency balances, matching guard_rules/guard_ledger.
  Lowering checks every attached agency including TERMINATED; safe 409 blocker list.
- Inactive type cannot be newly assigned; referenced type cannot be deleted.
  Historical maxDebt snapshots remain unchanged.
- Tests: debt equal to new limit passes, one VND over fails; zero limit; mixed
  terminated/active blockers; issue post vs lower limit; agency moves into type
  during limit change; duplicated code/name, stale ETag and rollback.

**Exit:** current limit/cap integrity and exact blocker responses under real concurrency.

## M09 — units

**Current evidence:** [owning child](../units/PLAN.md), [verification](../units/VERIFICATION.md); five operations and additive unit-policy revision 0005 locally complete.

**Prerequisites:** M02. **Effort:** medium. **Storage:** unit/product/line/count references.
**Proposed service:** UnitService.

- Five operations; read any unit.manage/product.manage/inventory.read, write unit.manage.
  Source allowsFraction defaults false; productCount is server derived.
- Used-unit fraction meaning cannot change after recorded use; INACTIVE blocks new
  goods use while historical names/units remain snapshots. Check actual references
  before deletion, not only current active products.
- Tests: unused fraction toggle, POSTED/canceled-history reference, fractional kg
  versus integer Cái, count references, inactive lookup, duplicate master fields,
  concurrent product assignment/delete and posting/fraction-policy change.

**Exit:** no reference or unit-meaning corruption, including seeded history.

## M10 — business_rules

**Current:** full local completion/D16 resolved; [plan](../business_rules/PLAN.md), [evidence](../business_rules/VERIFICATION.md).

**Prerequisites:** M07, M08. **Effort:** medium. **Storage:** singleton business_rule.
**Proposed service:** BusinessRuleService. **Gap:** D16 derived-price representation.

- GET and PATCH only. Reads follow any rules.manage/agency.manage/stock.issue.prepare/
  inventory.read; writes require rules.manage and If-Match.
- Lock singleton before counting capacity. Reject maxAgenciesPerDistrict below any
  ACTIVE district usage; cap equals maximum count passes. Return blocked districts.
- Validate price rate 0<rate<1000 with ≤6 decimals and no floats. Updating rate
  changes current product display/new READY prices, never frozen revisions.
- Resolve D16 before publication: a valid rate may generate a quote outside Money
  on already recorded products. Agree the response schema and issue-price error
  policy rather than making a subsequent product GET fail validation.
- Tests: empty patch/null/extra fields; cap zero, exact bound, concurrent last-slot
  agency creation vs cap lowering; rate limits/precision; old snapshots unchanged;
  audit before/after and transaction rollback.

**Exit:** singleton semantics, locks and immutable snapshot regression pass.

## M11 — products

**Current:** full local completion/D02/D16 verified; [plan](../products/PLAN.md), [evidence](../products/VERIFICATION.md).

**Prerequisites:** M09, M10. **Effort:** medium/high. **Storage:** product,
inventory_balance/overview and references. **Gaps:** D02, D16. **Service:** ProductService.

- Five operations; read any product.manage/inventory.read, write product.manage.
  Create with ACTIVE unit, generated MH-code and trigger-created zero balance.
- Exact currentSellingPrice and source line/document/revision/date are read-only.
  isLowStock uses strict `<`, not `<=`; product names are not unique.
- Apply D16's agreed derived-quote schema to list/detail, sorting and later mutation
  projections; test >Money-range and rounded-zero quotes without float/clamping.
- Changing unit after recorded use is forbidden; deleting a historical zero-net
  product is forbidden. Implement reviewed eligible-zero-cache deletion repair.
- Query stock ranges and currentSellingPrice sorting with correct tie breakers;
  lock masters and balances consistently with later posting.
- Tests: no price source, threshold boundary, inactive unit, repeated product name,
  posted/canceled/count references, no client-written caches, successful unused
  delete, direct cache delete denied, concurrent first use vs delete/unit change.

**Exit:** delete API works on genuinely unused products without weakening ledger guards.

## M12 — agencies

**Current:** full local completion/sharedD02 verified; [plan](../agencies/PLAN.md), [evidence](../agencies/VERIFICATION.md).

**Prerequisites:** M07, M08, M10. **Effort:** high. **Storage:** agency/balance and all
business references. **Gap:** D02 shared repair. **Service:** AgencyService.

- Six operations, including permanent terminate. Read any agency.read/manage;
  writes agency.manage. Generated immutable DL-code, duplicate contact/name allowed.
- Create ACTIVE with zero separate debt/credit; enforce active type/district and
  district cap atomically with rule/type/district locks.
- Patch locks profile/balance, validates new type against current debt, active move
  against destination capacity, acceptedDate against earliest existing document.
- Terminate is keyed and does not require zero debt; no reopen; later collection,
  return, credit/refund remain valid. New/posted issues must recheck ACTIVE.
- Eligible delete includes zero cache cleanup and all references, including drafts,
  canceled documents, payment and evidence. Apply D02 even if M11 track is separate.
- Tests: two creates for last slot, opposing district moves, lower rule/type limits,
  termination vs posting, old-history acceptedDate, duplicate name, stale/key reuse,
  used delete rejection and rollback/no code reuse.

**Exit:** capacity and debt checks verified with independent connections and seeded history.

## M13 — document_core

**Current:** internal slice verified; [plan](../document_core/PLAN.md),
[evidence](../document_core/VERIFICATION.md). Public history/line completion is M28.

**Prerequisites:** M11, M12. **Effort:** high. **Storage:** document/revision/line/batch.
**Actual services:** DocumentService, DocumentRepository and batches.reversal_values;
snapshots/provisional issue prices are owned by the shared service.

- Establish identity/current-revision ownership, generated codes, full replacement
  revision creation, snapshots, exact totals, typed detail/summary/mutation results.
- Build line/revision read and draft-write primitives for Document History; owning
  goods modules supply four kind validators. Public full dispatch closes in M28.
- No arbitrary generic post API. Strict current DRAFT checks; READY/POSTED content
  frozen; one product per revision; parent ETags and command-derived creation keys.
- Draft edits affect totals/audit only, never stock/debt/credit. For issue lines,
  derive provisional positive price from an established source; empty drafts valid.
- Add append-only POST/REVERSE/REALLOCATE primitives and exact reversal construction;
  actual kind posting/settlement remains in callers. Register mappings in Alembic.
- Tests: cross-parent line/revision 404, wrong kind, duplicate product, lineNo race,
  equal-total changed lines invalidate parent ETag, last line with immediatePayment,
  precision/overflow, deferred circular currentRevision FK and full rollback.

**Exit:** core primitives verified with all schema kinds in fixtures; dispatcher and
history operation completion remain explicitly deferred to M28.

## M14 — inventory

**Current:** full operation verified; [plan](../inventory/PLAN.md),
[evidence](../inventory/VERIFICATION.md). D14 statement balances use AggregateQuantity.

**Prerequisites:** M13. **Effort:** medium. **Storage:** inventory_entry/balance/views.
**Actual query/service:** InventoryService.statement and InventoryRepository stock helpers.

- Expose inventory.read product ledger; no duplicate product overview endpoint.
- Compute opening/closing and balanceAfter from full business checkpoints, then
  apply page/effective/source filters to displayed entries as specified in child
  semantics. Do not compute running totals from only the current page.
- Effective entry means original without a reversing row; historical mode includes
  both. Preserve signed quantityDelta, source version and date/order identity.
- Supply ordered balance lock/read and append helpers for receipt/issue/return/count;
  SQL remains cache authority and checks historical stock.
- Tests: empty ledger, same-date ordering, reversal/net-zero event, descending pages,
  opening before fromDate, missing product, cross-source filter and exact fractions.

**Exit:** statement independently reconciles to seed and isolated ledger fixtures.

## M15 — stock_receipts core

**Current:** five public operations/internal draft cancel verified; [plan](../stock_receipts/PLAN.md),
[evidence](../stock_receipts/VERIFICATION.md). M29 posted correction/full cancellation stay open.

**Prerequisites:** M14. **Effort:** high. **Actual workflow:** StockReceiptService.

- Implement list/create/detail/draft header/post and internal draft-cancel branch;
  `correctStockReceipt` and whole cancellation wait for M29.
- Read any stock.receipt.prepare/post/inventory.read; prepare writes prepare; post
  requires post; draft cancel requires documents.cancel, not inferred prepare.
- Create DRAFT, optional lines, positive unitPrice. Post requires lines and ACTIVE
  product/unit, captures snapshots, appends stock and chooses price source by date.
- Lock stock in product order, use one POST batch/revision, force constraints before
  returning inventoryChanges. Add receipt line dispatcher to document_core.
- Tests: backdated receipt does not replace newer source; equal-date original-order
  tie, concurrent receipts/issues, inactive unit, zero/negative/fraction inputs,
  totals overflow, duplicate post retry and definite commit failure rollback.

**Exit:** five full operations plus tested internal draft cancellation; full module
closure needs M29 and downstream-stock regression.

## M16 — settlement_core

**Implemented checkpoint2026-10-11:** E09/E10 internal gate passed; actual symbols,
contracts with SQL, full-seed replay, protected cash and617-case combined evidence
are in the [owning plan](../settlement_core/PLAN.md). Later HTTP/rounding/correction
gates stay in their owners. Work-package requirements below remain the scope.

**Prerequisites:** M15. **Effort:** high. **Gaps:** D06, D08, D17.
**Proposed responsibilities:** SettlementService, FifoAllocator, CreditProvenance,
ReservationService, SettlementReplay. No public endpoint.

- Map financial ledgers/lots/reservations and shared balance readers. Implement
  charge, linked-auto collection, manual collection and excess-permitted collection.
- Allocate at date/order, not today's debt; negative PAYMENT/CREDIT/RETURN entries
  target same-agency invoices. Preserve auto receipt's issue checkpoint.
- Add available-credit reserve/release/consume and deterministic lot/source ordering.
  Credit created from receipts/returns retains original cash provenance.
- Implement replay for supported source kinds now; later kinds extend a closed,
  typed handler registry with contract tests, not placeholder success handlers.
- Register all persisted dependency kinds separately from available HTTP writers.
  Seeded later returns/applications/refunds must be handled before an affected
  writer is published; use D17's deployment gate while handlers are still partial.
- Proposed pure interfaces: plan_fifo, pair_credit_provenance, plan_replay; persistence
  accepts a complete plan in caller transaction. No helper commits or writes caches.
- Tests: multi-invoice partial FIFO, earlier-date eligibility, manual overpay,
  external excess credit, linked auto exception, reverse/reallocate conservation,
  credit vs reserve race, same agency/source checks and failure after any appended leg.

**Exit:** real-PG primitives and chronological replay passed using isolated source
fixtures. This is not proof of public payment/provider completion.

## M17 — stock_issues core

**2026-10-17 implementation:** [owning plan](../stock_issues/PLAN.md) and
[80-case scoped/deployment evidence](../stock_issues/VERIFICATION.md) pass, including
M19 money branches. Seven operations are published; posted correction/cancel remains
M29. All370retained PG/TLS nodes also pass; the packet's final handoff is complete.

**Prerequisites:** M16. **Effort:** high. **Proposed workflow:** StockIssueService.

- List/create/detail/draft header/submit; internal no-money post/replacement/cancel.
  Source inventory lists exactly which operations remain partial through M19/M29.
- Read any prepare/post/debt.read/sales.read; preparation requires stock.issue.prepare;
  post stock.issue.post; no extra cash permission for a legitimate auto receipt.
- Create uses ACTIVE agency, acceptance date, server price and immutable agency.
  Submit locks relevant rate/master/stock/debt state, validates snapshot values and
  anticipated net debt, freezes READY and moves document PENDING without reserves.
- Post zero-upfront rechecks current stock/agency/unit/limit, keeps READY prices,
  records negative stock and charge atomically. Pending replacement preserves old
  READY history, creates DRAFT and requires re-submit.
- Tests: price changes after submit, missing source price, two READY issues competing
  for stock/limit, termination/inactivation before post, balance-neutral submit,
  partial line edits forbidden, old revision access and backdated downstream FIFO.

**Exit:** core service slices pass; do not publish partial money/cancel operations
as complete target behavior.

## M18 — payment_receipts core

**2026-10-17 implementation:** five public operations/internal draft cancellation
pass [owning evidence](../payment_receipts/VERIFICATION.md). M19 uses no-commit
receipt creation. Posted correction/full cancellation stays M29.

**Prerequisites:** M17. **Effort:** high. **Proposed workflow:** PaymentReceiptService.

- List/create/detail/draft header/post plus internal draft cancellation. Manual
  DEBT_COLLECTION CASH/BANK_TRANSFER only; agency immutable, terminated allowed.
- Read any cash.receipt.prepare/post/debt.read; prepare and post grants stay separate.
  No manually supplied invoice allocations, ONLINE flag or fake surplus credit.
- Post locks agency/source invoices, allocates FIFO at business date, captures
  contact snapshot and appends full payment effects in one transaction.
- Reuse no-commit internal receipt creation for auto/upfront/online consumers;
  standalone mutation rejects those receipt kinds/states from the first release.
- Tests: two receipts competing for same debt, amount equal/one over, future invoice
  excluded, backdated receipt replaying later allocations, cash vs credit distinction,
  duplicate intent, source audit and rollback after partially planned allocations.

**Exit:** five full operations pass; posted correction/cancel and full module close M29.
This operation gate is subject to D17 mixed-history replay: test valid insertion
before later returns, credit applications and refund evidence already in storage.

## M19 — upfront_payments and issue-money integration

**2026-10-17 implementation:** four upfront operations and the complete issue
post/replacement paths pass [owning evidence](../upfront_payments/VERIFICATION.md),
including real opposing post/separate races and full-money conservation.

**Prerequisites:** M18. **Effort:** high. **Proposed workflow:** UpfrontPaymentService.

- Four upfront operations plus postStockIssue and replacePendingStockIssue money
  branches. Reads follow source anyOf, verify requires cash.upfront.verify,
  receive-separately requires cash.receipt.post.
- Verify exactly current READY revision/positive immediatePayment and CASH/BANK
  evidence; one confirmation per revision; VERIFIED alone changes no balances.
- Post consumes VERIFIED while creating one linked auto receipt, inventory and
  charge/payment in a single atomic checkpoint. Recheck stock/current limit after
  waits. Any failure leaves the prior confirmation VERIFIED and money visible.
- Separate uses receivedAt's Vietnam date, records full cash, eligible FIFO and excess
  credit, updates confirmation once. Old revision cannot consume separated evidence.
- Replacement after separation creates fresh DRAFT without recycling evidence or
  implicitly claiming old cash was newly received. Posted issue cancellation waits M29.
- Tests: verification/duplicate race, post versus separate (both winners), wrong
  revision/amount, stock failure, net-within-limit despite intermediate gross excess,
  exact-date separation and full rollback/one cash receipt.

**Exit:** all upfront routes and full issue money/replacement operation gates pass.

## M20 — receivables

**2026-10-17 implementation:** six read operations pass
[owning evidence](../receivables/VERIFICATION.md). D14 historical debt uses
AggregateMoney after a persisted1.2e18 witness; current/stored Money remains bounded.

**Prerequisites:** M19. **Effort:** medium/high. **Proposed query:** ReceivableQueries.

- Six operations including the sole shared agency balance route. Financial reads
  use debt.read, except getAgencyBalance source anyOf credit.apply/cash.refund.post.
- Distinguish remainingAtIssue, current outstanding, separate current credit,
  reserved/available and current limit. Return financial identity without contact
  profile fields on overview; include ACTIVE/TERMINATED by default.
- Compute whole-filter totals and rows at one asOf snapshot. Invoice detail for
  existing non-POSTED/canceled source returns 409; wrong kind/path ownership handled.
- Statements include all CHARGE/PAYMENT/RETURN/CREDIT kinds and source version/
  reversals; same checkpoint shares final balanceAfter. No allocation mutation API.
- Tests: source-only vs invoice-target allocations, partial/settled-by-return/credit,
  reversal effectiveOnly, aggregate overflow above stored money range, date edges,
  duplicate names and totals not changing with pagination.

**Exit:** readers support seeded future-kind records now and get regression evidence
from later live writers; no duplicate M24 balance route.

## M21 — stock_adjustments core

Implementation/actual-symbol register: [owning plan](../stock_adjustments/PLAN.md),
[current evidence](../stock_adjustments/VERIFICATION.md); core gates pass.

**Prerequisites:** M15. **Effort:** medium. **Proposed workflow:** StockAdjustmentService.

- List/create/detail/draft update/post/internal draft cancel; posted correction/cancel
  closes at M29. Reads any prepare/post/inventory.read; source prepare/post grants.
- Signed nonzero quantity, reason required, price=0, total=0; no receivable/sales
  effect and no new purchase-price source. Reuse M13 line validation and M14 writer.
- Independent adjustments are distinct from count-linked historical evidence;
  enforce immutability of confirmed-count adjustments whenever encountered.
- Tests: positive/negative exact deltas, zero rejection, fractional unit policy,
  present stock sufficient but past stock negative, receipt-price unchanged,
  post race, count-linked rejection and rollback.

**Exit:** internal posting is reusable by counts; full correction branch deferred.

## M22 — stock_counts

Implementation/actual-symbol register: [owning plan](../stock_counts/PLAN.md),
[current evidence](../stock_counts/VERIFICATION.md); all ten operation gates pass.

**Prerequisites:** M21. **Effort:** high. **Proposed workflow:** StockCountService.

- Ten operations, no delete; stock.count throughout, plus stock.adjustment.post
  conditionally for nonzero differences. Count line edits use parent ETag.
- Capture bookQuantity + observedLastEntryId under stock locks; retain zero lines,
  no duplicate products, integer-unit rules. Header edit never overwrites observations.
- Recount supplies new count/time/reason for every existing product; rejects missing/
  duplicate/extra set members. Never reuse old observations with a refreshed snapshot.
- Confirm compares quantity and movement identity, links draft adjustment and confirms
  count before its own adjustment movement, then posts and commits together.
  Zero-only observations create no empty adjustment.
- Tests: stock moves away and back to same quantity; confirm vs issue; own-adjustment
  does not make snapshot stale; missing conditional permission; all-zero result;
  post failure rolls back count confirmation; CONFIRMED observations immutable.

**Exit:** full count lifecycle and linked adjustment integrity verified with real races.

## M23 — sales_returns core

Implementation/actual-symbol register: [owning plan](../sales_returns/PLAN.md),
[current evidence](../sales_returns/VERIFICATION.md). Reproduced protected successor
lot defect repaired by reviewed0007; core gates pass.

**Prerequisites:** M20. **Effort:** high. **Gaps:** D06/D08.
**Proposed workflow:** SalesReturnService, ReturnRoundingReplay.

- List/create/detail/draft header/post/internal draft cancel. Reads any returns.prepare/
  returns.post/debt.read/sales.read; writes use prepare/post; corrected/canceled posted
  paths remain M29. Source agency is derived from the POSTED issue.
- Lock source issue/product and agency timeline; source price/unit/line immutable;
  quantity cap uses cumulative effective returns against current sale quantities.
- Compute cumulative HALF_UP amount in business order. Zero-money return still adds
  stock; append no zero financial entry. Real return date cannot precede sale.
- Split min(return value, source unpaid amount) to debt; rest creates provenance-
  backed credit lots. Do not allocate a return to unrelated debt or auto-refund it.
- Extend replay for backdated partial returns and later immutable rounding/splits.
  Retain or reject downstream reserved/paid-source dependencies consistently.
- Tests: 1 VND item returned 0.5+0.5 → 1+0 VND, two returns racing for last quantity,
  settled/part-paid invoice, terminated agency, source correction price mismatch,
  credit-funded sale returned again and multi-stage rollback.

**Exit:** valid backdated and repeated partial returns supported with proven provenance;
full public posted correction/cancel closes M29.

## M24 — agency_credit

Implementation/actual-symbol register: [owning plan](../agency_credit/PLAN.md),
[current evidence](../agency_credit/VERIFICATION.md); reader/shared-service gates pass. Historical
statement balances use AggregateMoney after the real D14 witness.

**Prerequisites:** M23. **Effort:** medium. **Proposed query:** CreditQueries.

- Three owned credit endpoints; reuse M20 getAgencyBalance. Lot reads accept any
  debt.read/credit.apply/cash.refund.post; statement requires debt.read.
- Project source document/revision and origin cash receipt; balance/reserved/
  available are distinct. availableOnly filters actual available>0, not balance>0.
- Shared availability service from M16 also guards mutations; current reservations
  are not backdated historical debits. Effective/reversed history retains source.
- Tests: partially/fully reserved lots, released vs consumed, repeated source chains,
  sorted ties, historical opening/closing and no source/contact permission leakage.

**Exit:** reservation-aware readers reconcile before and after M25–M27 consumers.

## M25 — credit_applications core

**Prerequisites:** M24. **Effort:** high. **Proposed workflow:** CreditApplicationService.

- List/create/detail/update/post/internal draft cancel; corrected/posted cancel M29.
  Reads any credit.apply/debt.read; writes credit.apply; cancel documents.cancel.
- Draft is balance-neutral. Post locks agency/lots/invoices, selects same-agency
  unreserved credit by source date then lot ID and invoices by FIFO at application
  date. Full amount must fit both eligible debt and available historical credit.
- Append credit OFFSET and receivable CREDIT in one transaction, retaining cash
  provenance; cashReceived always string "0", no payment receipt.
- Tests: amount equals available, one-over, credit dated after application, source
  reservation vs application race, two applications for same lot, many-lot/many-
  invoice deterministic pairing, receipt provenance after later return and rollback.

**Exit:** no double use or invented cash; add replay handler for later corrections.

## M26 — online_payments

**Prerequisites:** M24. **Effort:** high. **Gap:** D07 deployed sandbox decision.
**Proposed components:** OnlinePaymentService, SandboxAdapter, PaymentRecovery.

- Six operations including signature-only webhook. Creation/reconcile/events require
  payments.online; list/detail also permit debt.read; webhook uses no user bearer.
- TX1 validates amount against current debt, stores PENDING + merchant key + recovery
  metadata, commits. Do not reserve debt. Setup returns 201 with checkout or 202 for
  persisted pending recovery. GET reads stored state, not an unbounded provider call.
- Verify raw HMAC/timestamp/key and reference/amount; create event and one full ONLINE
  receipt in TX2, FIFO available debt and surplus credit. Valid late success overrides
  local FAILED/EXPIRED; prior SUCCESS never regresses. Reconcile uses same workflow.
- Persist checkout/dispatch metadata and initiating actor; no provider I/O under locks.
- Tests: ±300-second boundary, invalid signature before parse, same event/different
  payload, webhook vs reconcile, two events for same transaction, intervening manual
  payment, late success, lost setup reply, process restart and no acknowledgement
  before commit. Real transport sandbox test is separate from seeded evidence.

**Exit:** six full operations, durable recovery, deployed sandbox gate and source cash
conservation; no browser-return shortcut.

## M27 — refunds

**Prerequisites:** M25, M26. **Effort:** high. **Proposed workflow:** RefundService.

- Twelve operations; manual subphase first, online subphase closes full module.
  Source anyOf reads, prepare/post writes and cancel allOf documents.cancel +
  cash.refund.post; no editable paid refund or direct reservation CRUD.
- Source one POSTED cash receipt, agency derived. ONLINE must use its original
  successful payment. Reserve full available same-source credit before sending;
  paid+reserved sum cannot exceed the source receipt amount.
- Keep document DRAFT while reserved; prohibit content edits. Manual confirmation
  uses paidAt/evidence, actual Vietnam date and same-transaction debit/consume/post.
- First online attempt commits PENDING before sending. Unknown outcome retains ACTIVE
  reservations; only verified failure releases. Retry failure uses fresh revision,
  reservations/attempt/key with same content; pending/unknown cannot start again.
- Tests: manual confirm vs cancel; reserve vs credit use; two source refunds;
  timeout/restart/reconcile; duplicate success; definitive failure then credit spent
  before retry; wrong payment/source; terminal immutability; late actual paid date;
  identified asynchronous postedBy and full rollback of final money recording.

**Exit:** all manual/online branches and recovery races pass, preserving source money.

## M28 — document_history

**Prerequisites:** M13, M22, M27. **Effort:** high. **Proposed components:**
DocumentHistoryQueries, DocumentPrintService, goods-kind line dispatcher.

- Close nine source operations. Reuse M13's line/revision primitives and all four
  goods handlers; financial revisions expose empty lines and reject line mutation.
- Kind-permission registry mirrors specialized collection readers. Search implicitly
  filters allowed kinds, explicit unauthorized kind returns 403. Wrong parent/kind
  IDs return source ownership errors, not leaked cross-document detail.
- History preserves old READY and POSTED versions, snapshot names/contacts and
  cancellation metadata. Print chosen/current revision with HTML default or PDF,
  proper Accept negotiation, draft/canceled markings and permission checks.
- Proposed render dependencies/font are in DESIGN; rendering uses a detached
  authorized projection, escaped strings and no network-fetched user URLs.
- Tests: all seven kinds across seeded states, old version after master rename,
  revision/line 404 ownership, conditional prepare grants, stale parent ETag, 204
  line deletion token, unsupported Accept 406 and Vietnamese PDF/text/layout.

**Exit:** all dispatch/print/history routes complete and usable by correction results.

## M29 — document_corrections and owning-module closure

**Prerequisites:** M28. **Effort:** very high. **Proposed components:**
CorrectionPlanner, DependencyClosure, ReplayCoordinator; endpoints stay in owners.

- Complete six correction operations and all posted branches of six cancellation
  operations for receipts/issues/manual cash/independent adjustments/returns/credit.
- Corrections require documents.correct AND respective post/apply permission;
  cancellation requires documents.cancel, plus cash.receipt.post if issue money
  must be separated. Enforce after reading state and also on retry result access.
- Preserve stable identity/agency/order and old versions; complete replacement and
  reason required. Reverse active effects, append replacement, replay all affected
  later sources, and validate final history/limits in one transaction.
- Keep actual upfront amount; synchronize auto receipt date via valid new versions.
  Canceled issue separates full real cash; manual cash cannot be reallocated into
  nonexistent debt. Source returns, paid refunds, counts and reservations constrain
  changes. Refuse invalid provenance instead of deleting/moving immutable evidence.
- Tests: multi-month stock-negative past/current-nonnegative case; moved businessDate;
  later FIFO changes across several receipts; auto receipt separation; return quantity/
  price cap and cumulative rounding; chained credit application/return; reserved or
  refunded source; correction vs receipt/refund/return races; injected failure after
  each replay stage restores every original revision/ledger/audit/command result.

**Exit:** all affected owning modules close only after their complete inventories and
cross-consumer regressions pass; all original-period reports reconcile independently.

## M30 — reports

**Prerequisites:** M29. **Effort:** high. **Proposed components:** ReportQueries,
ReportExportService. **Gap:** D14. **Storage:** existing views/functions + ledgers.

- Five operations, each supporting JSON, full-filter XLSX and PDF. Require reports.read
  AND relevant sales/debt/inventory grant for every format. Unsupported media 406.
- Sales counts current issue headers once, gross company denominator independent of
  filter/page; separate return-date/net. Debt closes from cash/return/credit decreases.
- Inventory groups original/reversal at effective dates, preserves units. Product
  sales includes quantity of 0-VND returns. Cash/credit excludes applications from
  cash, distinguishes refund payout from returns and unreceipted VERIFIED evidence.
- Page and totals share snapshot; export all matching rows independent of cursor/
  limit/page sort according to source. Preserve aggregate precision and exact XLSX
  text types for values spreadsheet numbers cannot represent.
- Tests: month/year/leap boundaries; returns-only negative net; duplicate names;
  corrected earlier month; company denominator under agency filter; >100 export
  rows, huge sums, formula-like names, empty reports, Vietnamese font/page overflow,
  format permission parity and no response body before successful rendering.

**Exit:** all fifteen format paths reconcile with independent ledger/reference queries.

## M31 — dashboard

**Prerequisites:** M30. **Effort:** medium. **Gap:** D09 contract admission decision.
**Proposed service:** DashboardService.

- One monthly operation composed from authorized read services; no additional
  reports.read requirement accidentally inherited from report HTTP routes.
- Compute only allowed sections, omit unauthorized fields entirely. Separate current
  debt/credit/low-stock/counts from month sales/cash. VERIFIED unreceipted money remains
  separate. Top agencies/products capped at 10 with deterministic tie handling.
- Child plan chooses a clear twelve-month trend window ending at requested month,
  including explicit zero-month buckets, aligned with source maxItems=12.
- Tests: each individual permission, no permissions 403, union admission after D09,
  permission removed on next request, historical month with current balances,
  twelve-point bounds, eleven tied candidates→ten, receipt separation prevents double
  counting and all sections share a coherent asOf.

**Exit:** per-field authorization and reconciled metrics; no cached cross-user section leak.

## M32 — chatbot

**Prerequisites:** M31. **Effort:** medium. **Gap:** D10 safe candidate continuation.
**Proposed components:** QueryIntentResolver, AgencyResolver, ChatbotService.

- One source POST query, read-only whitelist AGENCY_DEBT/INVENTORY/SALES. Check exactly
  debt.read/inventory.read/sales.read before entity/data lookup; no reports.read
  requirement just because sales uses the reporting query implementation.
- Resolve explicit agencyCode first; parse supported code/name forms from questionText;
  use structured productId/date context. Missing context returns NEEDS_CLARIFICATION;
  unsupported query returns 422 UNSUPPORTED_QUERY. Never execute generated SQL.
- Duplicate names return minimal candidates and require code selection; no merged
  debt or guessed employee ownership. Complete D10 paging under the same safe scope.
- D10 also resolves final one-candidate/empty continuation pages; do not infer unique
  identity just because a page has one result or retain source minItems=2 unchanged.
- Tests: supported Vietnamese questions, unknown code 404, ambiguous two and >25
  candidates, missing product/range, invalid date range, attempted mutation/SQL,
  unprivileged query, safe unavailable response and exact source tagged-union data.

**Exit:** complete source behavior over authorized real readers and final release
acceptance; no mandatory LLM account or conversation persistence introduced.
