# M29 design

Implementation/publication2026-10-29: all twelve owning operations use normal
aggregator composition and are deployed on existing dms at0009. Full M29 evidence is
in [VERIFICATION](VERIFICATION.md); no new runtime or generic correction API was added.

## Keep existing boundaries

Use M13 DocumentService/DocumentRepository, InventoryRepository.reverse_revision and
append, M16 SettlementService/repository/replay, M23 rounding/successor machinery,
M19 receipt/evidence separation and M27 reservation rules. No duplicate document
mapping, event store, generic posting HTTP endpoint or second API specification.
Owning modules retain schemas/routes. Introduce a small document_corrections service
for shared goods orchestration first; add financial coordination only when needed.

## Goods transaction (first executable slice)

1. TransactionRunner claims actor/operation/resource/key; fingerprint replacement
   body, not If-Match, matching existing retry semantics. Authorize documents.correct
   plus the owner's post grant (or documents.cancel). Audit uses correction/cancel.
2. Discover current product set without document locks. Lock business rules,
   products/units and inventory balances in existing sorted order, including all
   replacement products. Lock document/current revision. Rediscover/retry on changed
   dependencies rather than acting on an unlocked product.
3. Verify kind/independence, full current projection If-Match and required state.
   Reauthorize after locks. New goods use active master rules; historical snapshot
   reuse needs the separately reproduced D15 policy/SQL resolution.
4. Validate duplicate products, unit fractions, nonzero signs, line/total range.
   Create DRAFT successor with reason and replacement date/note/lines; retain old
   posted rows verbatim. Append REVERSE batch and exact original inventory reversals.
   Switch current pointer, mark successor POSTED, append its own POST and inventory
   at stable businessOrder. Cancellation instead sets metadata and reverses effects;
   DRAFT cancel has no ledgers and no invented revision.
5. Check complete inventory checkpoints for all old/new products, including removed
   goods. Reject negative history and current range overflow as safe 409. Deferred
   constraints reselect receipt price source and enforce all source consistency.
6. Project MutationResult after constraints/cache refresh, with ETag and revision
   Location for 201, then commit command/audit/effects together.

## Financial extension protocol (subsequent slices)

Lock agency type/master and stock before agency balance/history/document locks using
existing M16 order; discover all same-agency source IDs and required return products,
then revalidate closure after waits. Prepare replacement source, reverse superseded
financial effects, preserve stable origin cash/lot/reservation evidence and replay
chronologically with M16. M23 creates dependent return successors where cumulative
rounding changes; synchronize auto receipt via new revision. Do not reverse paid
refund effects or replace their actual evidence. Manual receipt insufficiency is a
genuine overpay conflict, not an unsupported-history fallback. Conditional separation
permission is checked on fresh work and completed replay. Current limit checked at
final replay, every historical invoice/lot checkpoint nonnegative.

## D15 decision gate

Current guard_revision checks active master/agency on every POSTED transition, even
for historic successors. First reproduce with real isolated SQL; record expected
versus actual. Select a narrowly scoped historical-successor allowance only if the
selected requirements demand it. New goods/first postings retain active admission.
Never insert directly as POSTED, disable constraints or alter immutable snapshots.

### Implemented receipt policy (deployed0008, current head0009)

The 0007 witness failed with23514 on a successor retaining an inactive original
product. Reviewed additive0008 now permits only receipt goods already present with
the same product/unit in a POSTED revision of that document. The service preserves
their recorded product/unit names. First posting and newly introduced inactive goods
remain rejected by both service and SQL. Adjustment admission is unchanged. Stock
issue/terminated-agency policy is separately implemented by0009;0008 does not relax it.

Historical goods lookup uses the latest POSTED snapshot for each product across the
same document, not just its current revision. Removing a product in an intermediate
correction does not erase its recorded names/unit or its historical eligibility.
Unrelated documents and never-posted lines do not confer eligibility. The2026-10-29
independent review found the prior current-revision-only lookup; the realPG red/green
regression and affected current-file gate are recorded in VERIFICATION.

### Next internal manual cash slice

Use the same stable document, original agency snapshot and full new date/amount/
manual method/reason. Lock agency type/master/balance and full agency history before
current revision/ETag. Reject ONLINE/AUTO_FROM_ISSUE/RECEIVED_UNAPPLIED for every state.
Reverse every effective financial leg of the superseded revision, append successor
POST batch and replay all current agency events. Cancel reverses current effects and
excludes the canceled source from replay. `SettlementService` accepts the existing
documents.correct/documents.cancel caller permissions for this orchestration, so
cancel-only users do not acquire an invented cash.receipt.post requirement. Caller
still enforces the correction allOf post grant before and after waits. Preserve
later immutable source revisions, cash provenance, reservations/paid refunds and
reject real overpay/history/current-limit violations atomically. Do not mount routes
until owning full-operation tests and deployment gates pass.

## Issue correction/cancel implementation continuation

`IssueCorrectionService` locks discovered old/replacement products and stock,
then agency/history, current issue and linked upfront evidence. Recheck product
discovery and allOf grants after waits. Preserve original agency/price/rate/limit
snapshots unless the canonical correction payload explicitly corrects price/rate;
new goods need active masters and a valid purchase-price source. Validate effective
return history against replacement goods/price/quantity/date before writing.

POSTED replacement reverses issue stock/charge, appends DRAFT→READY→POSTED successor
at stable original order, synchronizes a linked auto receipt with a new immutable
version when the date changes, and runs full M16 replay. Never change received cash.
Cancel DRAFT/PENDING/POSTED supports full evidence discovery across old revisions:
VERIFIED/CONSUMED money becomes one separate full receipt at actual received date;
reverse/cancel its former auto receipt, preserve the confirmation and finish it as
RECEIVED_SEPARATELY. Require cash.receipt.post when fresh work or stored command
result contains this separation; no new receipt on retry. Effective returns block
issue cancellation. All source effects, audit and command results remain atomic.

D15 issue retirement/termination is reproduced at0008 before a new reviewed revision.
Historical same-document/product/unit eligibility must not admit first postings or
new inactive products; no deployed SQL snapshot is edited.
The retained0009 fresh/populated downgrade/re-upgrade and three admission cases pass
for product/unit/agency retirement. Same-document historical agency/product/unit
snapshots remain eligible; first/new inactive admission remains denied.

## Return and credit correction continuation

`ReturnCorrectionService` excludes the source's old effective revision before
computing replacement cumulative amounts at the original businessOrder. It preserves
agency/origin and origin-line snapshots, reverses all superseded stock/financial legs,
appends the replacement, then uses M23.replace_rounding for changed later returns and
M16 replay for debt/credit/provenance. Cancellation removes the effective source,
recomputes later rounding and runs the same final history/stock/limit checks. Draft
cancellation stays possible when the original issue was subsequently cancelled.

`CreditCorrectionService` reverses active OFFSET/CREDIT legs, replaces the immutable
financial revision or cancels its document, then replays all current agency sources.
No receipt or new cash is created. Reuse canonical credit.apply plus documents.correct
for correction and documents.cancel for cancellation, with full precondition/key/live
grant protocol and a single caller-owned transaction.

## Verification structure

In-process HTTP or service calls against existing Supabase schema harness, asserting
independent persisted rows after commit/rollback. Two Session connections plus
observed blocking for concurrency. No server fixture is necessary for this slice.
Runtime deployment waits for complete operation gates; record source-only internal
work explicitly. Proposed symbols become actual register entries before closure.
