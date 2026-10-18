# General Plan

**Backend implementation order, module dependencies, and completion gates**

**Updated:** 2026-10-18. **Next module:** M25 `credit_applications` core.
M21 adjustment core → M22 counts → M23 return core → M24 credit readers pass their
owning gates. Runtime103target+2health; source/isolated/configured Supabase0007.
Actual packet verification:338offline+84realPG (29owning+55retained)+24direct/Nginx;
affected30-file production scope exact100%(1162statements/162branches).
M21/M23 full posted paths stay M29; M28/M29 and whole R4–R6 remain open.
**Status:** M01–M14, M15 core and M16 internal settlement retain earlier evidence;
M17 stock issues core, M18 manual receipts core, M19 upfront integration and M20
receivables pass their owning80-case/exact100% and22-case direct/Nginx gates.
Retained370PG/TLS and308offline now pass; affected33-file production coverage is
exact100%(1285statements/306branches). M17–M20/E11–E12 handoff is complete.
M28/M29 deferred document-history and receipt completion gates remain open.
The full goal remains active; R2/R3 engineering gates pass, R4–R6 are open.

Track slice progress, deferred integrations and release evidence in the
[Backend General Checklist](GENERAL_CHECKLIST.md). Per-function details remain in
the owning module checklist and verification log.

The [Full Backend Implementation Plan](plan/full_backend/PLAN.md) now supplies the
working-tree assessment, all 154 target operations, 32 detailed work packages,
transaction/replay design, schema/contract gaps and system verification strategy.
Its [execution companion](plan/full_backend/EXECUTION.md) defines 22 delivery packets,
price-range and persisted-history decision gates, and concrete release/UI handoffs.
M02 and [M03 user groups](plan/user_groups/PLAN.md) now have passing evidence.
M04 and M07–M09 now have owning six-file plans and passing full local gates.
M05/M06/M10/M11/M12 now have owning six-file plans and passing evidence.
M13/M14/M15 now have owning six-file plans and passing evidence.
M16 now has an owning six-file plan and [passing evidence](plan/settlement_core/VERIFICATION.md).
M17–M20 have owning six-file plans, actual-symbol registers and
[scoped evidence](plan/stock_issues/VERIFICATION.md). Retained prerequisite regression
also passes; see [program verification](plan/full_backend/VERIFICATION.md).
Follow the active [GOAL](plan/full_backend/GOAL.md).
Planning readiness does not close implementation gates.

The [module-layout refactor](../../backend/REFACTOR_VERIFICATION.md) preserves M01–M03
behavior with 159 offline, 108 PostgreSQL/TLS and 8 deployment tests passing.
Features now own `app/modules/<feature>/{router,schemas,models,service,repository,dependencies}.py`
as needed; `app/api/router.py` aggregates routes, with shared transport in `app/common/`
and cross-cutting infrastructure in `app/core/`/`app/db/`. The existing user mapping
is under `modules/users`; M04 administration and three catalogue APIs are implemented.
Current evidence: [M04](plan/users/VERIFICATION.md), [M07](plan/districts/VERIFICATION.md),
[M08](plan/agency_types/VERIFICATION.md), [M09](plan/units/VERIFICATION.md).

## 1. Where to start

Reuse [the implemented authentication module](plan/authentication/PLAN.md), then shared API
conventions and account administration, then master data, then document/ledger
workflows, and finally reporting and chatbot integration.

```text
Existing infrastructure and reviewed database
  -> Authentication and reusable authorization
  -> Shared API conventions + account/group/permission administration
  -> Master data and dealer management
  -> Document core + inventory + stock receipts
  -> Settlement core + stock issues + receipts + upfront integration
  -> Inventory counts + returns + credit + online payments + refunds
  -> Cross-document corrections + complete history/printing
  -> Reports + dashboard + chatbot
```

This is a recommended delivery order, not a claim that every earlier module is a
hard dependency of every later module. The dependency column in §3 is authoritative
for prerequisites; unrelated modules can be developed independently once their
prerequisites pass. A module spanning multiple slices is complete only after all
its source API operations and integration gates pass.

## 2. Sources and existing baseline

Read the sources before creating each module's detailed plan:

- [BA requirements](../BA/DMS_exploration.md): BM/QĐ, especially account/RBAC/audit
  and goods/payments/report requirements.
- [Database design](../database-design/README.md) and
  [business decisions](../database-design/business_decision_making.md): selected
  workflow, snapshot, FIFO, historical consistency, return/credit/refund rules.
- [DBML](../database-design/DMS.dbml) and
  [immutable initial DDL](../../backend/alembic/sql/0001_initial.sql): exact schema.
- [Target backend API](API/openapi.json): paths, operation IDs, schemas, permissions,
  preconditions, idempotency, and errors. Its business operations are future work.
- [Backend guidance](../../backend/AGENTS.md) and
  [verification workflow](../../.agents/workflows/verify.md): implementation conventions.

Already implemented: FastAPI application factory, settings, synchronous sessions,
liveness/readiness, Alembic revisions `0001`–`0007`, all 29 domain tables and SQL
guards/read models, core groups/function grants, full repeatable demo seed and SQL
verification. Preserve this baseline. Do not rebuild the database or edit deployed
snapshots to start a business module. Identity/access ORM mappings and seven auth
services/routes are implemented. Shared foundations and five group operations are
implemented alongside users/districts/agency types/units, issue/manual-receipt/upfront
workflows and receivables. M21–M24 now pass their linked owning gates; future code starts M25.
Revision 0004 adds command infrastructure; zero demo
command rows are legitimate. Revision 0005 serializes unit policy; reviewed0006
repairs eligible owner deletion, product first-use policy and agency/date races.

The baseline seed is useful for smoke tests, not a substitute for isolated fixtures,
service implementations, or transaction/concurrency tests. SQL routines protect
data; backend services must still construct complete authorized workflows.

## 3. Ordered implementation map

`Mxx` identifies an implementation slice; `module_name` identifies its future plan
folder `plan/<module_name>/`. Dependencies are direct prerequisites, with earlier
dependencies inherited transitively. Authentication/shared_api/user_groups have six-file
child plans; users/districts/agency_types/units now do too. The full-backend package contains work packages for every remaining
slice; expand each into its owning detailed child plan before code.

### Wave A — Access and shared API foundations

| Step | Module / slice | API scope / deliverable | Depends on | Completion gate |
| --- | --- | --- | --- | --- |
| M01 | `authentication` | Authentication: seven `/auth/*` operations, live bearer/session checks, reusable allOf/anyOf RBAC, safe errors/request IDs, auth throttling and reset delivery. | Existing baseline | Complete [PLAN](plan/authentication/PLAN.md), [TESTS](plan/authentication/TESTS.md), [CHECKLIST](plan/authentication/CHECKLIST.md) and evidence gates; real rotation/reset/invalidation races. |
| M02 | `shared_api` | Reuse auth plumbing for business errors; exact numeric/ID/date serialization, cursor/sort validation, ETag/If-Match/If-None-Match, operation-aware idempotency and rate-limit interfaces. | M01 | Contract-compatible helpers; stale/missing preconditions and duplicate/conflicting retries tested; no writes or migrations at API startup. |
| M03 | `user_groups` | User Groups: group list/detail/create/update/delete. Atomic grant cleanup on eligible deletion. | M02 | Referenced ACTIVE or LOCKED users block deletion; unreferenced group/grant cleanup audited and atomic; concurrent assignment/deletion tested. |
| M04 | `users` | Users: account list/detail/create/update, lock/unlock/group change, administrative password reset. | M03 | Case-insensitive unique email, hash-only credentials, group FK, ETags; all affected sessions invalidated in the write transaction; no implicit unlocking on password reset. |
| M05 | `permissions` | Permissions: read-only function registry, group grant reads/set using source allOf/anyOf rules and create/update preconditions. | M03, M04 | Missing/false grants denied; updates affect next request without stale cache; MANAGEMENT has no bypass; audit and concurrency/precondition tests pass. |
| M06 | `audit_logs` | Audit Logs: list/detail of immutable, credential-redacted audit entries. | M05 | Authorized read only; safe filters/keyset pagination; correct actor/function/request correlation; no edit/delete API. |

Authentication reads already-seeded groups/grants and therefore does **not** depend
on their administration endpoints. The write-audit context is delivered in M01;
business mutations need not wait for the M06 audit-browsing API to record audit.

### Wave B — Business master data

| Step | Module / slice | API scope / deliverable | Depends on | Completion gate |
| --- | --- | --- | --- | --- |
| M07 | `districts` | Districts: list/detail/create/update/delete; active state and capacity visibility. | M02 | Referenced districts cannot be deleted; inactive districts cannot receive new active agencies; cap comes from business_rule, not a new district attribute. |
| M08 | `agency_types` | Agency Types: list/detail/create/update/delete and credit limits. | M02 | Current debt blocks lowering maxDebt; referenced types, including terminated agencies, block deletion; history snapshots unaffected. |
| M09 | `units` | Units: list/detail/create/update/delete; allowsFraction policy. | M02 | Fraction policy and referenced-unit deletion enforced; unit meaning cannot change after recorded use. |
| M10 | `business_rules` | Business Rules: read/update singleton agency capacity and selling-price rate. | M07, M08 | Explicit locks/ETags; reject cap below active agency count; Decimal precision/range; changes audited and do not rewrite historical snapshots. |
| M11 | `products` | Products: list/detail/create/update/delete; unit, thresholds, current stock and calculated selling price. | M09, M10 | No client-written balances/prices; active-unit rules; recorded product unit cannot change; deletion/reference and precision tests. |
| M12 | `agencies` | Agencies: list/detail/create/update/delete/terminate. | M07, M08, M10 | Atomic district cap and credit-limit checks; zero initial balances, immutable code, no reopen of TERMINATED agency; transaction history blocks deletion. |

M07/M08/M09 can proceed independently after M02. Implementation plans for catalogue
changes must test existing seeded transaction references even before their HTTP
transaction modules exist. Do not assume early catalogue work has an empty DB.

### Wave C — Documents and core goods/cash workflows

| Step | Module / slice | API scope / deliverable | Depends on | Completion gate |
| --- | --- | --- | --- | --- |
| M13 | `document_core` | Shared identity/revision/line mappings and services; Document History draft-line CRUD foundation, parent ETags, snapshots, Decimal totals, creation keys, batch/reversal primitives and kind-to-permission dispatch. | M11, M12 | Correct parent/revision/line ownership; one product per revision; no changes to READY/POSTED content; financial documents reject goods lines; draft edits remain balance-neutral. |
| M14 | `inventory` | Inventory: `/products/{productId}/inventory-entries` statement and reusable stock read service; product overview remains owned by products. | M13 | Business-date/order balances, effective/reversed entries and opening totals correct; inventory.read enforced; seeded fixtures can verify reads before new posting endpoints. |
| M15 | `stock_receipts` — core | Stock Receipts: list/detail/create/draft update/post; draft cancellation. Add the STOCK_RECEIPT draft-line dispatcher in document_core. | M14 | Atomic positive inventory posting and latest-business-date purchase-price source; concurrent writes, snapshot/quantity validation, no success before commit. Posted corrections/cancellation close in M29. |
| M16 | `settlement_core` | Internal receivable charges/FIFO allocations, AUTO_FROM_ISSUE and RECEIVED_UNAPPLIED receipt posting, credit provenance/lots, reserve/release/consume and chronological replay for supported kinds. No separate public allocation CRUD. | M15 | Real-PG fixtures prove same-agency/source integrity, historical no-overpay/FIFO, backdated-post downstream replay, nonnegative debt/credit, reservation exclusion and rollback; reusable primitives do not commit caller transactions. |
| M17 | `stock_issues` — core | Stock Issues: list/detail/create/draft update/submit, pending revision replacement without received-money dependencies, zero-upfront posting, draft cancellation without money evidence. | M16 | ACTIVE agency/master rules; READY price snapshots fixed; post rechecks stock/current limit; no stock/debt reservation at submit. Money-dependent paths close in M19; posted correction/cancel close in M29. |
| M18 | `payment_receipts` — core | Payment Receipts: list/detail/create/draft update/post; draft cancellation. Expose manual DEBT_COLLECTION, reuse internal posting for other receipt kinds. | M17 | FIFO at businessDate, no future invoice payment/manual overpay; no standalone edit/cancel of automatic or online receipts; posted correction/cancel close in M29. |
| M19 | `upfront_payments` + stock-issue money integration | Upfront Payments: confirmation list/detail/verify/receive-separately; finish Stock Issues post with upfront payment and pending replacement after evidence separation. | M18 | Issue + automatic receipt + inventory/debt + CONSUMED atomic; VERIFIED alone balance-neutral; failed delivery retains evidence; separate receipt records full money and excess credit; retries cannot double count. |
| M20 | `receivables` | Receivables: overview, agency balance, invoice balances, statements, document allocations; expose `/agencies/{agencyId}/balance` once as the shared Receivables/Agency Credit resource. | M19 | Original remainder differs from current outstanding; settled means obligation settled, not necessarily new cash; same-day atomic balance and effective-entry pagination correct. |

**Avoid a circular dependency:** M16 supplies internal receipt/credit machinery;
M17 supplies source invoices and READY issue records; M18 exposes manual receipts;
M19 adds the cross-module upfront paths. The entire stock_issues module is still
partial after M17, not falsely marked complete before its M19/M29 gates.

Keep write services separated by responsibility, but compose one caller-owned
transaction for cross-module posting. Never make an internal HTTP request to another
module's endpoint to complete an atomic operation.

### Wave D — Counts, returns, credit and external payments

| Step | Module / slice | API scope / deliverable | Depends on | Completion gate |
| --- | --- | --- | --- | --- |
| M21 | `stock_adjustments` — core | Stock Adjustments: list/detail/create/draft update/post and internal draft cancellation; adjustment line seam. | M15 | Verified signed stock-only deltas/reason/zero price, historical stock and count-link protection; [owning plan](plan/stock_adjustments/PLAN.md), [evidence](plan/stock_adjustments/VERIFICATION.md). Posted paths M29. |
| M22 | `stock_counts` | Stock Counts: headers/lines/recount/confirm; internal adjustment posting for nonzero differences. | M21 | Verified movement identity/fresh recount/zero lines/conditional atomic adjustment; [owning plan](plan/stock_counts/PLAN.md), [evidence](plan/stock_counts/VERIFICATION.md). |
| M23 | `sales_returns` — core | Sales Returns: list/detail/create/draft update/post/internal draft cancel and immutable cumulative-rounding replay. | M20 | Verified cap/zero increments/backdating/original cash and reserved/paid sources, reviewed0007; [owning plan](plan/sales_returns/PLAN.md), [evidence](plan/sales_returns/VERIFICATION.md). Posted correction/cancel M29. |
| M24 | `agency_credit` | Credit-lot/detail/entry reads and shared available-credit service; sole balance route stays M20-owned. | M23 | Verified separate/reserved/available balances, origin/reversal history and exact aggregate statements; [owning plan](plan/agency_credit/PLAN.md), [evidence](plan/agency_credit/VERIFICATION.md). |
| M25 | `credit_applications` — core | Credit Applications: list/detail/create/draft update/post and draft cancellation. | M24 | Available unreserved same-agency credit + invoice FIFO; preserve source provenance; cashReceived=0; concurrent consumption/reservation tests; posted correction/cancel close in M29. |
| M26 | `online_payments` | Online Payments: create/read/list/events/reconcile and provider-signature webhook; sandbox adapter only. | M24 | Commit PENDING before provider call; verified signature/amount/reference; duplicate and late success record one full receipt, FIFO debt and excess credit; browser return is not payment proof; no network under DB locks. |
| M27 | `refunds` | Refunds: draft/read/list/update/submit/confirm-paid/cancel, reservations, online attempts/detail/reconcile; cash/bank first, online after adapter integration. | M25, M26 | One source receipt per refund; reserve before sending; UNKNOWN retains reservation; confirmed failure releases; success posts/debits/consumes once; refunded money cannot be canceled; retry uses source-defined fresh revision/attempt. |

Stock adjustments/counts can proceed independently of cash workflows after M15.
Returns and online payments both use M16 settlement primitives. Refunds are last in
this wave because they must prove that money reserved or already refunded cannot
also be consumed through credit applications or lose its source provenance.

### Wave E — History, cross-workflow correction, and read products

| Step | Module / slice | API scope / deliverable | Depends on | Completion gate |
| --- | --- | --- | --- | --- |
| M28 | `document_history` | Complete Document History search/revision/line reads, kind-specific draft-line CRUD and snapshot printing with HTML/PDF content negotiation. | M13, M22, M27 | Permissions filter by kind; explicit unauthorized kind rejected; historical revisions readable and immutable; print historical snapshots, clearly mark draft/canceled versions; all goods-kind dispatchers wired. |
| M29 | `document_corrections` + owning-module completion | Shared replay orchestration and domain-specific posted corrections/cancel for stock receipts/issues, manual payment receipts, independent adjustments, returns and credit applications. Endpoints retain their owning API tags/modules. | M28 | Reverse old effects + new revision + downstream FIFO/return/credit replay atomic; full historical and current limits respected; preserve actual received/refunded money and reservations; corrections use original business period, not new sale/return fiction. |
| M30 | `reports` | Reports: sales/debt/inventory/product-sales/cash-and-credit, JSON and full-filter XLSX/PDF exports. | M29 | Reconcile ledger and snapshot totals after corrections; original-period reversal, return period, cash vs credit distinguished; half-open dates, consistent totals/filter denominator; same permissions for JSON/export. |
| M31 | `dashboard` | Dashboard: monthly authorized sections, current balances, pending/VERIFIED money, charts and top lists. | M30 | Per-section permissions/no leaks; no double-counting unreceipted upfront money; current balance not confused with period flow; source top-10 limits. |
| M32 | `chatbot` | Chatbot: debt/inventory/sales query whitelist and agency disambiguation, using authorized read services. | M31 | Same debt.read/inventory.read/sales.read checks; no mutation/arbitrary SQL; duplicate names require code selection; unsupported vs clarification responses conform to API. |

Reports/dashboard/chatbot may have early read-only prototypes against seeded data
once their underlying readers and RBAC pass, but their **full completion gates**
above require integrated transaction/correction evidence. Chatbot reads services,
not dashboard HTTP; M31 is the recommended final integration/validation prerequisite.

## 4. Dependency graph

Arrows mean "must pass before this slice can be completed." This graph is acyclic
because split stock-issue/payment/correction work is assigned explicit later gates.

```mermaid
flowchart TD
  M01[Authentication] --> M02[Shared API]
  M02 --> M03[User groups]
  M03 --> M04[Users]
  M03 --> M05[Permissions]
  M04 --> M05
  M05 --> M06[Audit reads]
  M02 --> M07[Districts]
  M02 --> M08[Agency types]
  M02 --> M09[Units]
  M07 --> M10[Business rules]
  M08 --> M10
  M09 --> M11[Products]
  M10 --> M11
  M07 --> M12[Agencies]
  M08 --> M12
  M10 --> M12
  M11 --> M13[Document core]
  M12 --> M13
  M13 --> M14[Inventory reads]
  M14 --> M15[Stock receipts core]
  M15 --> M16[Settlement core]
  M16 --> M17[Stock issues core]
  M17 --> M18[Payment receipts core]
  M18 --> M19[Upfront and issue integration]
  M19 --> M20[Receivables]
  M15 --> M21[Stock adjustments core verified]
  M21 --> M22[Stock counts verified]
  M20 --> M23[Sales returns core verified]
  M23 --> M24[Agency credit verified]
  M24 --> M25[Credit applications core]
  M24 --> M26[Online payments]
  M25 --> M27[Refunds]
  M26 --> M27
  M13 --> M28[Document history]
  M22 --> M28
  M27 --> M28
  M28 --> M29[Corrections and owning-module completion]
  M29 --> M30[Reports]
  M30 --> M31[Dashboard]
  M31 --> M32[Chatbot]
```

Master-data/document work inherits authentication from M02. All business routes
must explicitly enforce their source permission policy even if administrative
modules M03–M06 were developed on a separate track.

## 5. Cross-module responsibilities and deferred endpoints

### Shared infrastructure is extracted incrementally

- M01 implements the auth-required subset of errors/request IDs/limiting. M02
  reuses and extends it for general business APIs; do not duplicate auth plumbing.
- M13 owns document IDs/revisions/lines/snapshots and primitive batches. M16 owns
  financial posting/allocation/provenance primitives. Domain modules supply kind-
  specific validation and state transitions; no unrestricted generic posting API.
- M29 orchestrates cross-document replay, while stock receipts/issues/payment/
  adjustment/return/credit modules own their corrections and cancel endpoints.
- M16 already supplies chronological replay for valid backdated postings; M23
  extends it to return rounding/provenance. M29 completes correction orchestration,
  rather than introducing the first replay support after earlier writers ship.
- Every business write supplies validated actor/function/request context and calls
  `SET CONSTRAINTS ALL IMMEDIATE` as needed before reading refreshed caches, then
  commits before returning success. Deferred SQL checks are not optional.
- External provider calls happen between short transactions, never inside row
  locks. Same business keys preserve idempotency across retries/reconciliation.

### Partial module delivery is explicit

Draft cancel and new posting can be delivered before posted correction/cancel.
Until M29 passes, do not mount an incomplete posted-operation endpoint as if it
implements the target contract, or return a successful placeholder. Runtime docs
describe only implemented routes; detailed plans list deferred operation IDs.
After each later consumer is added, strengthen dependent-state guards and rerun
affected earlier module tests before claiming integrated completion.

The [operation inventory](plan/full_backend/OPERATIONS.md) distinguishes first
internal delivery from whole-operation publication. A shared endpoint with valid
deferred state/kind branches stays internal until those branches are supported;
the first slice alone is not a fully published target operation.

Publication also depends on the kinds already persisted in the target database
(D17): the demo contains later return/credit/refund records today. Financial writers
must support their dependency closure before shipping, even if those kinds' HTTP
writers come later. R3/R4 are engineering integration milestones; the complete live
document-workflow handoff is R5, after lines and posted cancellation/corrections.
D16 is resolved: DerivedSellingPrice represents readable current quotes, while
common.prices.stored_selling_price enforces positive Money for later issue writers.

Examples: stock receipts cannot be corrected without checking later stock use;
issues may require receipt separation, FIFO replay and valid return sources;
returns/credit corrections must not invalidate a paid or reserved refund source;
confirmed count adjustments and paid refunds remain immutable.

Conditional permissions require explicit service-level checks after inspecting
state: `cash.receipt.post` when canceling an issue needs separate received-money
posting, `stock.adjustment.post` for nonzero count differences, kind-specific
permissions for document/history routes, and per-section/query-type reads for
dashboard/chatbot. Basic allOf/anyOf support does not cover these automatically.

## 6. Detailed plan and strict-test policy for every module

Before implementation, create `plan/<module_name>/` with:

```text
PLAN.md           # Scope, operation ownership, phases, prerequisite slices
REQUIREMENTS.md   # BA/database/API traceability and conflict decisions
DESIGN.md         # Symbols, queries, transaction/lock/idempotency protocol
TESTS.md          # Actual-symbol register, success/failure/boundary cases
CHECKLIST.md      # Function/operation gates, including deferred operations
VERIFICATION.md  # Exact commands, results, state/concurrency evidence, blockers
```

Use [authentication](plan/authentication/PLAN.md) as the existing template, adapted
to the module's actual behavior. Do not generate all empty folders and mark them
planned; a detailed plan must resolve its real inputs, endpoints and test cases.

Every completed function/helper/method/validator/dependency/route must have:

1. Its actual symbol and source requirements registered in TESTS.
2. Passing meaningful success, failure and boundary assertions, including safe
   responses/logs where inputs are sensitive.
3. Persisted-state and rollback tests for DB mutations, and real PostgreSQL for
   query/constraint/transaction behavior; relevant multi-connection concurrency
   tests for locks, caps, idempotency, posting or money/token consumption.
4. A declared scoped statement/branch coverage gate and recorded passing evidence.
   Authentication's existing gate is 100%; future plans must explicitly define
   their scope/gate rather than silently omit coverage requirements.
5. Exact commands/results in VERIFICATION before CHECKLIST is closed. Required
   skips/xfails/unrun tests keep the item incomplete.

A module closes only after its full operation inventory, cross-module dependencies,
migration/seed compatibility, permissions, contract schemas/statuses/headers and
required verification pass. A successful static check or baseline SQL regression
does not prove business API, concurrency or external sandbox behavior.

## 7. Progress and next action

| Area | Current state | Next action |
| --- | --- | --- |
| Runtime/database infrastructure | Implemented baseline | Preserve and rerun relevant checks during business work. |
| Authentication M01 | Seven operations/RBAC implemented; 122 offline + 58 PostgreSQL/TLS tests, 100% scoped coverage and 4 direct/Nginx smoke cases | Preserve [evidence](plan/authentication/VERIFICATION.md); deploy migration/key/mail configuration explicitly. |
| Whole-backend execution design | Prepared: 154-operation inventory, 32 work packages, 22 delivery packets, 17 gap decisions and verification plans | Use [full-backend package](plan/full_backend/PLAN.md) and [release handoffs](plan/full_backend/EXECUTION.md); resolve gap gates in their owning slices. |
| M02 shared_api | P0–P5 implemented; exact values/errors/audit/cursors/ETags/commands verified | Preserve [evidence](plan/shared_api/VERIFICATION.md), including 0004/seed/race/coverage compatibility. |
| M03 user_groups | Five operations implemented; 21 PG cases, symbol register and scoped 100% coverage | Preserve [evidence](plan/user_groups/VERIFICATION.md); M04 reruns assignment/deletion with its real writer. |
| M04 users | Five operations locally complete, atomic session effects and joined-label locks | Preserve [evidence](plan/users/VERIFICATION.md); M05 prerequisite now verified. |
| M07–M09 catalogues | Fifteen operations locally complete; populated references, independent races and 0005 unit policy repair | Preserve [districts](plan/districts/VERIFICATION.md), [types](plan/agency_types/VERIFICATION.md), [units](plan/units/VERIFICATION.md); actual M10–M12 consumers/regressions now pass. |
| M05/M06/M10/M11/M12 | Twenty full operations locally complete, D02/0006 and D16 resolved | Preserve [permissions](plan/permissions/VERIFICATION.md), [audit](plan/audit_logs/VERIFICATION.md), [rules](plan/business_rules/VERIFICATION.md), [products](plan/products/VERIFICATION.md), [agencies](plan/agencies/VERIFICATION.md). |
| M13 document_core | Internal all-kind readers/draft/revision/line/snapshot/batch foundations locally verified | Preserve [evidence](plan/document_core/VERIFICATION.md); full history/line dispatch remains M28. |
| M14 inventory | Full statement operation and stock/reversal helpers locally verified; D14 historical aggregate range resolved | Preserve [evidence](plan/inventory/VERIFICATION.md), including all seeded goods kinds and filter-independent atomic balances. |
| M15 stock_receipts core | Five full operations and internal draft cancel locally verified | Preserve [evidence](plan/stock_receipts/VERIFICATION.md); posted correction/full cancellation remain M29. |
| M16 settlement_core | E09/E10 internal FIFO/provenance/reservations and chronological replay locally verified | Preserve [evidence](plan/settlement_core/VERIFICATION.md), including existing return/credit/refund financial effects; owning later HTTP/rounding gates remain open. |
| M17 stock_issues core | Seven operations including M19 posting/replacement implemented; owning tests/races pass | Preserve [evidence](plan/stock_issues/VERIFICATION.md); posted corrections/cancel remain M29. |
| M18 payment_receipts core | Five manual-receipt operations and protected special receipts implemented | Preserve [evidence](plan/payment_receipts/VERIFICATION.md); posted corrections/cancel remain M29. |
| M19 upfront_payments | Four operations, full-money consumption/separation and issue integration implemented | Preserve [evidence](plan/upfront_payments/VERIFICATION.md); retain M29 money-preserving cancellation gate. |
| M20 receivables | Six complete read operations implemented; exact snapshots/atomic ledgers/historical aggregates verified | Preserve [evidence](plan/receivables/VERIFICATION.md); M24 reuses the sole balance route. |
| M21/M22/M23/M24 | Owning plans/actual symbols and scoped state/rollback/race/coverage/deployment gates pass | [Adjustments](plan/stock_adjustments/VERIFICATION.md), [counts](plan/stock_counts/VERIFICATION.md), [returns](plan/sales_returns/VERIFICATION.md), [credit](plan/agency_credit/VERIFICATION.md); dependency edges unchanged. |
| M25–M32 | Work packages prepared; remaining HTTP work future | Next M25 credit_applications after M24 verification; preserve D17 and M28/M29 gates. |

Current dependencies are unchanged. M04 and M07–M09 table gates above have passed
their linked child evidence: 207 offline + 217 PostgreSQL/TLS + 16 deployment
cases, exact 100% combined coverage. The graph retains all owning prerequisites.

Prior M01–M16 regression: **247 offline +370 PostgreSQL/TLS**, exact100% across
4096 statements/830 branches; head0006, retained migration/seed/54-check cases.
Direct/Nginx20-case evidence is retained from M15, not rerun in the internal M16 task.
At the M17–M20 checkpoint runtime published80/154 target+2health. Its owning gate:
80cases, exact100%(808statements/98branches),22direct/Nginx. Configured Supabase
explicitly upgraded0002→0006 and live integrity/demo checks passed. Retained370current
PG/TLS nodes now pass across checkpointed/resumed runs;308offline passes. E11/E12 and
the scoped R3 engineering gate close. Affected M16–M20/shared production coverage is
33files/1285statements/306branches exact100%; this is not untouched-code coverage.
No dependency edges were removed; M05 precedes M06 and M10 precedes M11/M12.

When work advances, update this file's current module/progress, the General
Checklist and the owning plan's checklist/evidence in the same task. Record
dependency changes with a reason and update the graph/table together; distinguish
prerequisite slices from whole-module completion. Keep root/backend AGENTS aligned
with this roadmap.
