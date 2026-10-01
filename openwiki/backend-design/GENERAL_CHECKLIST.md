# Backend General Checklist

**Updated:** 2026-10-01. **Next slice:** M01 `authentication`.
**Status:** business HTTP implementation not started; existing infrastructure/
database baseline is documented. Checked planning items do not imply completed
business functions or new runtime verification.

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
  [plan/authentication](plan/authentication/PLAN.md); implementation remains not started.
- [x] Existing health/settings/session/schema/migration/seed baseline documented
  in [backend guidance](../../backend/AGENTS.md) and [README](../../backend/README.md).
- [ ] Reconfirm relevant baseline checks/schema head in the isolated implementation
  environment before making changes; do not treat old evidence as a new test run.
- [ ] Prepare each next module's child plan before code, mapping source operations,
  permissions, contract errors/headers, symbols, tests and deferred integrations.

## 2. Ordered slice checklist

### Wave A — Access and shared foundations

- [ ] M01 `authentication` — seven auth operations/live-session/RBAC dependencies;
  meet the [auth checklist](plan/authentication/CHECKLIST.md), coverage and real token
  rotation/reset/invalidation races. Requires: existing baseline.
- [ ] M02 `shared_api` — exact serializers/errors/cursors/sorts/preconditions/
  idempotency and rate-limit interfaces tested. Requires: M01.
- [ ] M03 `user_groups` — CRUD, referenced-user deletion guard and atomic grant
  cleanup audited; concurrent assignment/deletion tested. Requires: M02.
- [ ] M04 `users` — account/group/lock/admin-reset workflows, CI email/ETags and
  all affected session invalidation pass. Requires: M03.
- [ ] M05 `permissions` — registry/grants/preconditions/current-grant enforcement,
  no MANAGEMENT bypass, audited concurrent changes pass. Requires: M03, M04.
- [ ] M06 `audit_logs` — safe authorized list/detail filters, correlation and
  immutable credential-redacted projections pass. Requires: M05.

### Wave B — Master data

- [ ] M07 `districts` — CRUD/state/capacity/reference guards tested with existing
  transactions, not just an empty DB. Requires: M02.
- [ ] M08 `agency_types` — credit-limit lowering blockers/referenced-type
  protection, including terminated agencies, pass. Requires: M02.
- [ ] M09 `units` — fraction policy/state/delete guards preserve recorded unit
  meaning and references. Requires: M02.
- [ ] M10 `business_rules` — capacity/rate Decimal validation, ETags/locks and
  audit preserve historical snapshots. Requires: M07, M08.
- [ ] M11 `products` — active-unit/threshold/state/reference behavior and exact
  current-price reads; no client-written balances. Requires: M09, M10.
- [ ] M12 `agencies` — atomic capacity/limit checks, immutable identity, safe
  delete and permanent termination pass. Requires: M07, M08, M10.

### Wave C — Documents and goods/cash core

- [ ] M13 `document_core` — mappings/draft/revision/line ownership/kind dispatch,
  snapshots/totals, parent ETags and primitive batches pass. Requires: M11, M12.
- [ ] M14 `inventory` — date/order/effective-entry reads and opening balances
  pass with inventory.read enforcement. Requires: M13.
- [ ] M15 `stock_receipts` core — drafts/lines/post/draft cancel and atomic stock/
  business-date price-source checks pass; posted correction deferred. Requires: M14.
- [ ] M16 `settlement_core` — real PostgreSQL proves charge/FIFO/receipt/credit/
  provenance/reservation primitives and rollback. Requires: M15.
- [ ] M17 `stock_issues` core — draft/READY/no-money pending replacement and
  zero-upfront post pass; money/correction integration deferred. Requires: M16.
- [ ] M18 `payment_receipts` core — manual receipts/date-valid FIFO/no intentional
  overpay pass; posted correction deferred. Requires: M17.
- [ ] M19 `upfront_payments` + issue integration — verified/consumed/separate
  receipt workflows preserve full received money atomically. Requires: M18.
- [ ] M20 `receivables` — overview/balance/invoice/statements/allocations distinguish
  original remainder, current outstanding and settlement. Requires: M19.

### Wave D — Counts, returns, credit and providers

- [ ] M21 `stock_adjustments` core — signed quantity/reason/zero-price stock-only
  posting and historical stock guards pass. Requires: M15.
- [ ] M22 `stock_counts` — snapshot identity/recount/conditional approval/zero
  differences and immutable confirmed observations pass. Requires: M21.
- [ ] M23 `sales_returns` core — source price/provenance/cumulative rounding/
  quantity cap and stock/debt/credit split pass. Requires: M20.
- [ ] M24 `agency_credit` — lot/source/statement/available-vs-reserved projections
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
- [ ] Counts detect intervening movement even when stock returns to same quantity;
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
| M01 authentication | Detailed plan ready; implementation not started | [Current evidence](plan/authentication/VERIFICATION.md); planning validation only | Execute auth P0–P6 with required tests. |
| M02–M32 | Roadmap only | No implementation evidence yet | Prepare owning detailed plan after prerequisites. |

Current next action: execute the existing M01 plan. This checklist does not create
new child-module plans or mark any business function complete.
