# Full backend implementation plan

## M31 published / M32 AI direction - 2026-10-29

getDashboard published153/154business+2health/0009; only chatbot absent. Final1084
offline incl291dashboard,14unique owningPG,3dashboard+8retained deployed cases pass.
Dashboard161/24/API68/0 exact100%, D09 unchanged. All240source hashes match image;
live411documents/30agencies/24products/acceptedreceipt/payment/event retained.
[Evidence](../dashboard/VERIFICATION.md). Next M32 user-selected AI API; provider
details/D10/owning plan/implementation remain per HANDOFF. Whole R5/R6/system/recovery/
backup/browser/terminalbankrefund gates remain separate. Older checkpoints are history.

## M29-M30 published checkpoint - 2026-10-29

All twelve owning corrections/cancels and all five report operations are verified/
published:152/154business+2health at0009. Final1083offline,11unique M30PG plus normal-app
HTTP/resource rerun and11unique deployed endpoint cases pass across documented resumes.
Per-file reports438/98/API66/0/sharedresponses48/18 exact100%; M29disjoint22file1124/196
separate. Automated rendered-output inspection is not a human visual claim. Live411
documents/30agencies/24products and original payment/receipt/event retained. Existing
Docker/ngrokhealthy, frontendunchanged. [Current evidence](../reports/VERIFICATION.md).
Next M31 then M32 and remaining full R5/R6/terminalbankrefund/finalrelease/browser
gates; historical source-only or deferred M29/M30 statements below are superseded.

## M29 source-only internal checkpoint — 2026-10-25

Receipt/independent-adjustment and manual-cash correction/cancel services now have
owning [M29 evidence](../document_corrections/VERIFICATION.md):572offline+27owningPG+
12retainedPG, affected310/76exact100%. Source0008 is isolated-test verified; configured
runtime remains0007/135target+2health. No M29 handler is published. Continue zero-upfront
issue then remaining E19 orchestration/gates; M30–M32 and R5/R6 remain open.

## Current native VNPAY checkpoint — 2026-10-25

M26/M27/M28 APIs published:135target+2health. Native merchant/automatic IPN/payment/
query/refund transport accepted;568offline/40uniquePG/6deployment, declared packet
1783/408exact100% pass. Live411documents includes one authorized10200VND receipt774.
External bank refund remains verifiedPENDING; no paid-refund/full-release claim.
Next code M29. Exact current evidence is in the owning VERIFICATION files.

## Active delivery checkpoint — 2026-10-24

M25 core is mounted and verified. M26–M28 implementations are exercised through the
isolated full-branch composition, with owning tests/coverage/reviews and controlled
HTTP/Docker evidence recorded in their VERIFICATION files. Normal runtime108target+
2health at0007; accepted external sandbox/prerequisite publication gates remain open.
M29 is next in roadmap order; R5/full posted correction/cancellation is not closed.
The chronological assessment below retains its original checkpoint counts.

**Prepared:** 2026-10-02. **Updated:** 2026-10-18. M21–M24 declared scopes pass;
next code is M25 credit_applications after its owning plan. Source/configured head0007.
**Status:** active implementation; M01–M14, M15 core and M16 internal settlement pass local gates.
M17–M20 are implemented with80owning tests/exact100%,370retained PG/TLS,308offline
and22direct/Nginx passing. Affected33-file production scope is exact100%(1285/306).
M21–M24 owning/retained/deployment gates pass:338offline+84PG+24direct/Nginx,
affected30-file exact100%(1162statements/162branches).
M25–M32 and deferred M28/M29 operations remain unimplemented.
[GOAL](GOAL.md) tracks the active destination and
[AVAILABILITY](AVAILABILITY.md) published operations. This is the execution design,
not a new runtime module or a replacement HTTP specification.

## 1. Destination and reading order

Deliver the complete Agentra backend described by the selected business decisions
and target OpenAPI: **154 operations across 28 API areas**, plus the two existing
health operations. Preserve authentication, historical evidence, exact money,
inventory/debt/credit reconciliation and the repeatable demo throughout delivery.

| Document | Use |
| --- | --- |
| [REQUIREMENTS](REQUIREMENTS.md) | Current-state assessment, source precedence, BA/decision traceability and frontend needs. |
| [OPERATIONS](OPERATIONS.md) | Exhaustive operation ownership and first/full delivery gates; each operation counted once. |
| [DESIGN](DESIGN.md) | Module boundaries, transaction/locking, idempotency, replay, schema and integration design. |
| [MODULES](MODULES.md) | Implementation work packages for all 32 slices: inputs, work, failure cases and exit evidence. |
| [EXECUTION](EXECUTION.md) | Concrete delivery packets, immediate M02 task, migration checkpoints and usable release/frontend handoffs. |
| [DECISIONS](DECISIONS.md) | Concrete code/schema/contract gaps, proposed resolutions and remaining decision gates. |
| [TESTS](TESTS.md) | Cross-module acceptance, concurrency, coverage, migration and release strategy. |
| [CHECKLIST](CHECKLIST.md) | Planning and implementation gates for this program. |
| [VERIFICATION](VERIFICATION.md) | Checks actually run for this planning package; prior auth evidence is linked separately. |

The [General Plan](../../GENERAL_PLAN.md) remains the canonical M01–M32 order and
dependency graph. Its [General Checklist](../../GENERAL_CHECKLIST.md) remains the
implementation progress tracker. This package supplies the engineering detail
behind those slices. The [shared API child plan](../shared_api/PLAN.md) makes the
next slice actionable. Before later module code, expand its MODULES work package
into the six owning child documents and register actual symbols as introduced.
These work packages are substantive full-scope plans, but do not pretend that
future function names have already been implemented or tested.

## 2. Delivery milestones

Dependencies are inherited from the General Plan; milestones below do not add
blanket dependencies between otherwise independent tracks.

| Milestone | Slices | Demonstrable result | Required exit evidence |
| --- | --- | --- | --- |
| R0 — Existing baseline | M01 + infrastructure | Login/refresh/logout/reset/current permissions and seeded database | Preserve existing auth gates; reconfirm in the implementation environment. |
| R1 — Business API foundations | M02 | Contract-safe errors, exact values, preconditions, durable retries, shared test harness | Real duplicate/stale/rollback races; browser header compatibility; auth regression. |
| R2 — Administration and catalogues | M03–M12 | Staff/groups/grants/audit and dealer/product/master administration | Last-capacity-slot and limit races; eligible deletion migration; populated-seed references. |
| R3 — Goods and cash | M13–M20 | Engineering integration of stock, sales, cash, upfront money and statements | Atomic issue/receipt; chronology-aware FIFO; failed issue retains money; independent reconciliation; publication subject to D17. |
| R4 — Counts and money lifecycle | M21–M27 | Engineering integration of counts, returns, credit, sandbox collections and refunds | Same-stock stale count; rounding/provenance; reservation/callback races; sandbox transport and complete persisted-kind replay. |
| R5 — Complete historical workflows | M28–M29 | Historical lines/printing and every allowed posted correction/cancel | Full dependency replay and rollback; immutable counts/paid refunds; complete owning operation inventories. |
| R6 — Complete read products and release | M30–M32 + release gates | Five reports with exports, authorized dashboard, read-only chatbot | Corrected-period reconciliation, permission isolation, full-filter export, direct/proxy deployment and operational runbook. |

**Recommended immediate sequence:** expand M25 credit_applications' owning plan,
then implement its core using verified M24 availability and M16 settlement seams.
M21 adjustments/M22 counts/M23 return core/M24 readers now pass their owning gates.
Stock issues/manual receipts/upfront/receivables retain
their [owning gate](../stock_issues/VERIFICATION.md). Settlement E09/E10 retain their
[internal gate](../settlement_core/VERIFICATION.md).
After stock_receipts,
the stock_adjustments/stock_counts track can proceed alongside settlement work.
Online payments can proceed alongside credit applications after agency_credit.

The critical financial chain is document_core → stock_receipts → settlement_core
→ stock_issues → payment_receipts → upfront integration → returns/credit → refunds
→ corrections. Allocate the most design/review time to settlement and corrections.
Building many CRUD routes first will not remove this critical path.

## 3. Execution unit and handoff

Each implementation task should fit one coherent transaction or read product:

1. Read the owning work package, source operations, SQL guards and dependencies.
2. Complete the module's child PLAN/REQUIREMENTS/DESIGN/TESTS/CHECKLIST/VERIFICATION.
3. Resolve the blocking decision IDs in DECISIONS; reproduce SQL gaps before migration.
4. Implement a vertical slice: schemas → repository/query → service → route → tests.
5. Verify real persisted state, failure/rollback and relevant races; compare actual
   HTTP requests/responses/headers against the target components.
6. Record exact evidence and the actual symbols; update operation availability,
   owning checklist, general tracker and frontend integration readiness together.

A handoff records operation IDs, accepted state branches, migration head, required
environment, exact commands, remaining dependencies and next task. Do not report
“stock issues done” while money or posted corrections are still deferred.

### Partial-operation publication

One operation can span several slices. The inventory's first slice is an internal
implementation/test milestone, not permission to advertise full contract support.
For example, `postStockIssue` becomes fully usable after M19; `cancelStockReceipt`
after M29. Until all target branches are ready, keep the partial handler internal
or outside the published release API. Runtime OpenAPI lists delivered behavior,
never a placeholder success or an undocumented generic rejection of valid input.
Shared document-line endpoints need all four goods-kind dispatchers before full
publication; earlier domain creates may include their own line arrays.

The Full column is also subject to **persisted-data dependency coverage**. The demo
already has all seven document kinds, including later returns/credit/refunds. A
writer with only some replay handlers is an internal slice until it handles every
relevant persisted kind. [EXECUTION §3](EXECUTION.md#3-early-implementation-versus-a-usable-release)
defines release bundles and concrete frontend handoffs; D17 records this gate.

## 4. Scope and practical planning assumptions

- Preserve the current synchronous FastAPI/SQLAlchemy modular monolith and external
  PostgreSQL. One business, one warehouse, VND, employee group permissions.
- All seven document kinds, counts, returns, refunds, credit, sandbox payments,
  historical corrections and export formats are included in whole-backend delivery.
- Operational baseline is one API worker/replica, consistent with the existing
  limiter. Shared throttling and trusted-proxy client identity become prerequisites
  before increasing process count; durable money/idempotency must work across
  independent processes even in the initial release.
- Existing historical evidence remains linked; current M04/E05 verification reruns
   the retained auth gates. Current M05/M06/M10–M12 packet also passes all gates at
   source head0006; external Supabase deployment
  must be checked explicitly.
- UI implementation follows its own roadmap. Backend completion can be verified
  through real HTTP and PostgreSQL before UI screens exist; full product completion
  additionally requires the frontend's browser gates.
- Provider choice, derived-price representation and API permission/pagination
   inconsistencies are explicit decision gates in DECISIONS with named future owners;
   D16 is resolved for published quotes; later stored issue writers retain its seam.

No calendar promise is inferred from endpoint counts. Use R1 and the first
stock-receipt posting slice to measure implementation/review/test throughput,
then estimate remaining work. Relative effort: administration/master data medium;
shared API/document core high; settlement/returns/providers high; cross-document
corrections very high; reporting/export high; dashboard/chatbot medium once readers
exist. Completion means verified workflows, not a percentage based on route count.

## 5. Final release gate

All 154 source operations must have one owner, correct schemas/statuses/headers,
current permission checks and linked evidence. Close every deferred state branch,
all mandatory tests and required sandbox/deployment gates. Demonstrate a fresh and
populated upgrade, repeatable seed, complete ledger reconciliation, recovery from
uncertain money outcomes, and correct original-period reports after corrections.
The release checklist also requires exact environment documentation, restart and
reconciliation instructions, backup/restore rehearsal for the target deployment,
and a frontend-facing list of actually available operations.
