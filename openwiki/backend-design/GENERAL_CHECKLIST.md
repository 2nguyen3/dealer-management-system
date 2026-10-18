# Backend General Checklist

**Updated:** 2026-10-18. **Next:** M25 credit_applications core.
M21 core/M22/M23 core/M24 pass owning gates. Source/configured Supabase0007;
runtime103target+2health. Actual packet338offline+84PG (29owning+55retained)+24deployment,
affected30-file exact100%(1162statements/162branches). Prior705-case whole baseline
remains historical; M28/M29 and whole R4–R6 stay open.
**Historical M17–M20 checkpoint:** owning80-case/exact100% and22-case deployment
evidence. Retained370PG/TLS and308offline pass; affected33-file production scope is
1285statements/306branches exact100%. M25–M32 and R4–R6 remain open.
Deferred M28/M29 history/receipt gates stay open.
R2/R3 engineering backend gates passed; [GOAL](plan/full_backend/GOAL.md) remains active.

Module-layout preservation verified on 2026-10-04: 159 offline + 108 PostgreSQL/TLS
tests, strict scoped 100% coverage and 8 direct/Nginx smoke tests. See
[refactor evidence](../../backend/REFACTOR_VERIFICATION.md); delivery dependencies
and future-module gates are unchanged.

Use with the [General Plan](GENERAL_PLAN.md) and [target API](API/openapi.json).
This tracks roadmap slices, deferred integrations and release readiness;
per-function cases/results belong in the owning child checklist and VERIFICATION.

## 1. Tracking rules and planning readiness

- Check a slice only after its prerequisites, common gate (§4) and slice-specific
  tests pass, with evidence linked in §7. A plan file alone does not close it.
- A checked core slice is not a fully completed module with deferred operations.
  Full-module closure also requires §3 and the owning complete operation inventory.
- Required skipped/xfailed/unrun tests keep the item open; record exact blockers.
- Apply §4 to each slice in its child checklist. General common/release checkboxes
  represent evidence across the declared release scope, not a one-time waiver for later work.
- Keep this checklist, General Plan table/graph/progress and child evidence aligned.
  Module names and direct prerequisites below mirror the General Plan.

- [x] General Plan prepared with M01–M32 and an acyclic dependency graph.
- [x] Authentication detailed materials prepared under
  [plan/authentication](plan/authentication/PLAN.md); implementation/evidence now recorded.
- [x] Existing health/settings/session/schema/migration/seed baseline documented
  in [backend guidance](../../backend/AGENTS.md) and [README](../../backend/README.md).
- [x] Reconfirm relevant baseline checks/schema head in the isolated implementation
  environment before making changes; do not treat old evidence as a new test run.
- [ ] Prepare each next module's child plan before code, mapping source operations,
  permissions, contract errors/headers, symbols, tests and deferred integrations.
- [x] Prepare the [whole-backend execution package](plan/full_backend/PLAN.md):
  current-state assessment, exhaustive operations, 32 work packages, gap owners,
  architecture, acceptance/race and release plan.
- [x] Prepare and verify [M02 shared_api](plan/shared_api/PLAN.md) with symbols/evidence.
- [x] Prepare and verify [M03 user_groups](plan/user_groups/PLAN.md) before closure.
- [x] Prepare before code and verify owning [M04](plan/users/PLAN.md),
  [M07](plan/districts/PLAN.md), [M08](plan/agency_types/PLAN.md), [M09](plan/units/PLAN.md).
- [x] Deep-review the current package and define [delivery/release handoffs](plan/full_backend/EXECUTION.md),
  including derived-price D16 and persisted-kind D17 gates.

## 2. Ordered slice checklist

### Wave A — Access and shared foundations

- [x] M01 `authentication` — seven auth operations/live-session/RBAC dependencies;
  meet the [auth checklist](plan/authentication/CHECKLIST.md), coverage and real token
  rotation/reset/invalidation races. Requires: existing baseline.
- [x] M02 `shared_api` — exact serializers/errors/cursors/sorts/preconditions/
  idempotency and rate-limit interfaces tested. Requires: M01.
- [x] M03 `user_groups` — CRUD, referenced-user deletion guard and atomic grant
  cleanup audited; concurrent assignment/deletion tested. Requires: M02.
- [x] M04 `users` — account/group/lock/admin-reset workflows, CI email/ETags and
  all affected session invalidation pass. Requires: M03.
- [x] M05 `permissions` — registry/grants/preconditions/current-grant enforcement,
  no MANAGEMENT bypass, audited concurrent changes pass. Requires: M03, M04.
- [x] M06 `audit_logs` — safe authorized list/detail filters, correlation and
  immutable credential-redacted projections pass. Requires: M05.

### Wave B — Master data

- [x] M07 `districts` — CRUD/state/capacity/reference guards tested with existing
  transactions, not just an empty DB. Requires: M02.
- [x] M08 `agency_types` — credit-limit lowering blockers/referenced-type
  protection, including terminated agencies, pass. Requires: M02.
- [x] M09 `units` — fraction policy/state/delete guards preserve recorded unit
  meaning and references. Requires: M02.
- [x] M10 `business_rules` — capacity/rate Decimal validation, ETags/locks and
  audit preserve historical snapshots. Requires: M07, M08.
- [x] M11 `products` — active-unit/threshold/state/reference behavior and exact
  current-price reads; no client-written balances. Requires: M09, M10.
- [x] M12 `agencies` — atomic capacity/limit checks, immutable identity, safe
  delete and permanent termination pass. Requires: M07, M08, M10.

### Wave C — Documents and goods/cash core

- [x] M13 `document_core` — mappings/draft/revision/line ownership/kind foundations,
  snapshots/totals, parent ETags and primitive batches pass. Requires: M11, M12.
- [x] M14 `inventory` — date/order/effective-entry reads and opening balances
  pass with inventory.read enforcement. Requires: M13.
- [x] M15 `stock_receipts` core — drafts/lines/post/internal draft cancel and atomic stock/
  business-date price-source checks pass; posted correction deferred. Requires: M14.
- [x] M16 `settlement_core` — real PostgreSQL proves charge/FIFO/receipt/credit/
  provenance/reservation primitives, backdated chronological replay and rollback.
  Requires: M15.
- [x] M17 `stock_issues` core — draft/READY/no-money pending replacement and
   zero-upfront post pass; M19 money integration also tested, correction M29 deferred.
   Owning/deployment/retained regression pass. Requires: M16.
- [x] M18 `payment_receipts` core — manual receipts/date-valid FIFO/no intentional
  overpay pass; posted correction deferred. Requires: M17.
- [x] M19 `upfront_payments` + issue integration — verified/consumed/separate
  receipt workflows preserve full received money atomically. Requires: M18.
- [x] M20 `receivables` — overview/balance/invoice/statements/allocations distinguish
  original remainder, current outstanding and settlement. Requires: M19.

### Wave D — Counts, returns, credit and providers

- [x] M21 `stock_adjustments` core — signed quantity/reason/zero-price stock-only
  posting and historical stock guards pass. Requires: M15.
- [x] M22 `stock_counts` — snapshot identity/recount/conditional approval/zero
  differences and immutable confirmed observations pass. Requires: M21.
- [x] M23 `sales_returns` core — source price/provenance/cumulative rounding/
  quantity cap, backdated return replay and stock/debt/credit split pass. Requires: M20.
- [x] M24 `agency_credit` — lot/source/statement/available-vs-reserved projections
  and shared agency balance service pass. Requires: M23.
- [ ] M25 `credit_applications` core — same-agency unreserved credit + invoice
  FIFO consumes once, cashReceived stays zero. Requires: M24.
- [ ] M26 `online_payments` — sandbox setup/read/events/reconcile/webhook prove
  signature/idempotency/late full success and excess credit. Requires: M24.
- [ ] M27 `refunds` — source-bound manual/online reserve/send/reconcile/retry
  preserves UNKNOWN reserves and immutable paid money. Requires: M25, M26.

### Wave E — History, corrections and read products

- [ ] M28 `document_history` — complete kind-dispatched lines/history/search
  and authorized snapshot HTML/PDF printing pass. Requires: M13, M22, M27.
- [ ] M29 `document_corrections` + owning-module completion — posted correction/
  cancel/replay, conditional permissions and downstream guards pass. Requires: M28.
- [ ] M30 `reports` — all five reports, exact periods/totals and whole-filter
  authorized JSON/XLSX/PDF results reconcile after replay. Requires: M29.
- [ ] M31 `dashboard` — authorized sections/current-vs-period metrics/
  unreceipted-money visibility/top limits pass. Requires: M30.
- [ ] M32 `chatbot` — whitelisted authorized reads/ambiguity/clarification/
  unsupported behavior; no arbitrary SQL or mutations. Requires: M31.

## 3. Deferred integration and full-module closure

- [ ] Stock receipts close through M15 + M29: posted correction/cancel preserves
  downstream stock use and historical purchase-price consistency.
- [ ] Stock issues close through M17 + M19 + M29: upfront consumption/separation,
  pending replacement and posted correction/cancel all completed.
- [ ] Manual receipt/independent adjustment/return/credit-application posted paths
  close through M29; automatic/online/received-unapplied money cannot be edited away.
- [ ] Confirmed count adjustments and paid refunds remain immutable; refunded,
  reserved or consumed credit retains valid source provenance during corrections.
- [ ] Shared document/history dispatch covers every goods kind and all versions;
  financial-only documents never gain goods-line CRUD.
- [ ] New return/online/refund/count consumers trigger affected earlier module
  regression checks and dependent-state guards before integrated closure.
- [ ] Every owning child checklist's full source operation inventory has no
  required deferred operation/test/dependency remaining.
- [ ] Close the [gap register](plan/full_backend/DECISIONS.md) at each owning gate:
  durable retries, safe unused-cache cleanup, seed/head compatibility, replay/
  provenance, deployed sandbox, dashboard admission, chatbot candidate paging,
  derived-price range and persisted-kind deployment coverage.
- [ ] Published operations meet their full gates in the
  [operation inventory](plan/full_backend/OPERATIONS.md); partial internal branches
  do not imply complete runtime contract support.

## 4. Common gate for each implemented slice/function

- [ ] Actual symbols/helpers/validators/dependencies/routes registered with source
  requirements and meaningful passing success/failure/boundary tests.
- [ ] Source schemas/statuses/headers/preconditions and permission rules tested,
  including state-dependent conditional authorization.
- [ ] Real isolated PostgreSQL query/constraint tests; mutations prove persisted
  state and definite rollback/commit-failure behavior, not mock call counts.
- [ ] Relevant independent-connection races prove caps/locks/idempotency/
  single-use consumption and final source-money integrity.
- [ ] All required tests pass without skip/xfail substitutions and declared scoped
  coverage passes (authentication: 100% statements/branches).
- [ ] Safe outputs/logs/audit and bound SQL tested; password/hash/raw-token secrets
  never leak outside designated credential persistence/response fields.
- [ ] Synchronous request session/caller-owned write transaction; deferred checks
  forced before reading caches; no success before commit or provider I/O under locks.
- [ ] Reviewed additive migrations/fresh and populated upgrade/mapping names/seed
  compatibility verified; deployed SQL snapshots unchanged.
- [ ] Exact commands/results/case IDs/coverage/state/concurrency evidence recorded
  in child VERIFICATION before its per-function checklist is closed.

## 5. Integrated system acceptance

- [ ] Auth/session/permission changes invalidate or deny the next appropriate
  request; baseline health/docs remain available as designed.
- [ ] Master-data cap/limit changes remain valid with concurrent posting and
  existing references; historical snapshots unchanged.
- [ ] Receipt → issue → manual/upfront cash reconciles stock/invoice/agency
  balances atomically, without intermediate false rejection.
- [ ] Failed issue posting preserves VERIFIED money; separate receipt/FIFO/excess
  credit retry cannot lose or double-count it.
- [ ] Partial return → credit use → manual/online refund preserves rounding,
  receipt provenance and reservation exclusion.
- [ ] Duplicate/late payment success and refund UNKNOWN/retry settle once;
  browser return data never authorizes money posting.
- [ ] Posted correction/reversal replays all affected sources, reconciles original
  periods and keeps historical balances nonnegative/current limits valid.
- [x] Counts detect intervening movement even when stock returns to same quantity;
  zero differences create no empty adjustment.
- [ ] Reports/dashboard/print/chatbot use correct snapshots/current-vs-period
  semantics and authorized data across all document kinds.

## 6. Verification and release

- [ ] Frozen install, Ruff lint/format and complete offline tests pass from
  `backend/` using the [verification workflow](../../.agents/workflows/verify.md).
- [ ] Required PostgreSQL/integration/concurrency/coverage commands pass; missing
  requested integration setup fails explicitly rather than silently skips.
- [ ] Migration head/seed repeatability/live SQL verification pass in an explicitly
  isolated environment; new module tests supplement the baseline 54 regression checks.
- [ ] Settings/examples/README/AGENTS/runtime API match implementation; no secrets
  or provider credentials tracked.
- [ ] Direct/proxied API and required sandbox/mail smoke evidence recorded;
  optional unrun deployment checks distinguished from required incomplete gates.
- [ ] Both general checklists/roadmaps and child evidence agree; frontend readiness
  communicated by actual implemented operation/slice availability.
- [ ] Intended release modules fully closed or explicitly scoped as partial;
  incomplete operations never presented as completed API behavior.

## 7. Evidence and blockers register

Add rows only when work produces evidence. Link the exact child VERIFICATION
heading and scope, e.g. "core verified; posted correction pending M29" rather
than "module complete". Do not copy secret-bearing output into this register.

| Slice / module | Scope/status | Child evidence / exact command result | Blocker / next dependency |
| --- | --- | --- | --- |
| M01 authentication | Seven operations and reusable RBAC implemented; local completion gates passed | [Current evidence](plan/authentication/VERIFICATION.md): 122 offline, 58 PostgreSQL/TLS, 100% scoped coverage, 4 direct/Nginx smoke cases | Next M02; provider mail and Supabase schema deployment are operational inputs. |
| Whole-backend plan | Execution-design package deep-reviewed; delivery/release handoffs prepared | [Planning verification](plan/full_backend/VERIFICATION.md); no new runtime evidence | Implement M02, then owning slices; resolve D01–D17 at their gates. |
| M02 shared_api | E01/E02 and P0–P5 locally verified | [M02 evidence](plan/shared_api/VERIFICATION.md): exact types/headers/context, 0004, seed and command/race/recovery tests; strict combined coverage | Preserve R1 prerequisites in later modules. |
| M03 user_groups | All five operations locally verified | [M03 evidence](plan/user_groups/VERIFICATION.md): 21 PG cases, both FK orders, real post-lock grant revocation, scoped 100%, direct/proxy CRUD | Real M04 writer assignment/deletion rerun passed in [M04 evidence](plan/users/VERIFICATION.md). |
| M04 users | Full five-operation local completion | [Evidence](plan/users/VERIFICATION.md): real admin/auth/group/email/ETag races, rollback and exact coverage; retained in current564-case scope | M05 prerequisite now verified. |
| M07 districts | Full five-operation local completion | [Evidence](plan/districts/VERIFICATION.md): global capacity/count/state/all-reference guards and both-order races | M10 rules/M12 agencies remain separate consumers. |
| M08 agency_types | Full five-operation local completion | [Evidence](plan/agency_types/VERIFICATION.md): exact limits/terminated blockers, snapshots, issue-post/assignment races and late balance-lock grant revocation | M10/M12 remain separate consumers. |
| M09 units | Full five-operation local completion | [Evidence](plan/units/VERIFICATION.md): recorded policy/reference guards, first-use races, populated upgrade and 0005 repair | M11 products remains a separate consumer. |
| M05 permissions | Five full operations locally complete | [Evidence](plan/permissions/VERIFICATION.md): pair/precondition/owner deletion races, live post-wait authorization, exact contract/coverage | Preserve M03/M04 prerequisites. |
| M06 audit_logs | Two full operations locally complete | [Evidence](plan/audit_logs/VERIFICATION.md): exact redacted nested JSON, actors, immutable tie/filter/append pages | M05 dependency passed. |
| M10 business_rules | Two full operations locally complete, D16 resolved | [Evidence](plan/business_rules/VERIFICATION.md): rate/cap/audit/rollback/admission races and persisted D16 quotes | Later issue writers retain positive stored-price gate. |
| M11 products | Five full operations locally complete, reviewed0006/D02 | [Evidence](plan/products/VERIFICATION.md): current/source quotes, recorded-use/deletion/state races, migration/seed compatibility | M13/M15 actual consumers now also verified. |
| M12 agencies | Six full operations locally complete | [Evidence](plan/agencies/VERIFICATION.md): cap/type/history/termination/key/replay authorization/reference races | M13 prerequisite passed; settlement/issue consumers follow. |
| M13 document_core | Internal foundations verified; M28 operations deferred | [Evidence](plan/document_core/VERIFICATION.md): all7 kinds/history, neutral lines/revisions, ETags, frozen-content/rollback/race and exact100% | Full history/public line dispatch remains M28. |
| M14 inventory | Full operation locally complete | [Evidence](plan/inventory/VERIFICATION.md): atomic ledger balances, all seeded goods/reversals, D14 aggregate range, HTTP/grants and exact100% | Retain later writer integration. |
| M15 stock_receipts core | Five full operations; internal draft cancel verified | [Evidence](plan/stock_receipts/VERIFICATION.md): keyed neutral drafts, atomic stock/price/snapshots, mixed history, rollback/opposing races, direct/Nginx; current564+20 cases | Posted correction/full cancellation remain M29. |
| M16 settlement_core | E09/E10 internal completion; no new HTTP operation | [Evidence](plan/settlement_core/VERIFICATION.md):28 offline+25 PG added;617 combined, exact100%(4096/830), all seeded financial kinds, state/rollback/observed races and resolved reviews | M17–M19 real writers, M23 rounding and M27/M29 orchestration/publication remain separate gates. |
| M17–M20 | Four owning implementations verified; all370retained PG/TLS pass | [M17](plan/stock_issues/VERIFICATION.md), [M18](plan/payment_receipts/VERIFICATION.md), [M19](plan/upfront_payments/VERIFICATION.md), [M20](plan/receivables/VERIFICATION.md):80owning cases/exact100%(808/98),308offline,397PG/TLS overall,22direct/Nginx; affected33-file100%(1285/306), Supabase0006 live integrity | M29 posted paths remain deferred; next M21. |
| M21–M24 | Declared core/count/reader scopes verified | [M21](plan/stock_adjustments/VERIFICATION.md), [M22](plan/stock_counts/VERIFICATION.md), [M23](plan/sales_returns/VERIFICATION.md), [M24](plan/agency_credit/VERIFICATION.md):338offline+84PG+24deployment,30files/1162/162 exact100%, Supabase0007/live integrity/cleanup | M21/M23 posted paths M29; next M25. |
| M25–M32 | Work packages prepared; runtime work open | No completion evidence | Expand M25 after the active packet; R4–R6 full gates remain open. |

Current next action: expand M25 credit_applications' owning six-file plan before code.
Runtime availability and remaining
full gates are recorded in [AVAILABILITY](plan/full_backend/AVAILABILITY.md).
