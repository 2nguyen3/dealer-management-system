# Frontend General Checklist

**Updated:** 2026-10-01. **Next slice:** F01 `frontend_foundations`.
**Status:** health-check starter only; business UI and child-module plans not started.
Checked planning items do not imply passing UI behavior or browser tests.

Use with the [frontend General Plan](GENERAL_PLAN.md),
[backend General Plan](../backend-design/GENERAL_PLAN.md),
[backend checklist](../backend-design/GENERAL_CHECKLIST.md) and
[single target API](../backend-design/API/openapi.json).
This is general tracking, not a child-module plan. Detailed frontend plans and
per-symbol test registers will be prepared only when requested.

## 1. Tracking rules and planning readiness

- Check a slice after frontend prerequisites, relevant backend operation gates,
  common checks (§4) and strict slice tests pass; link evidence in §7.
- Contract-mocked progress belongs in the register, not a checked live-completion
  box. F01's own offline foundation work can close on its declared test scope;
  business/auth slices require their actual API/browser gates.
- A checked core slice does not close modules with deferred paths; see §3.
- Required skipped/xfailed/unrun tests or unavailable required APIs keep gates
  open. Record exact blocked operations, not simply "backend pending".
- Apply §4 per slice in its child checklist; general common/release checkboxes
  represent evidence across the declared release scope, not a waiver for later features.
- Keep General Plan/checklist and child evidence aligned. Frontend prerequisites
  below mirror the roadmap; its backend integration column remains authoritative.

- [x] Frontend General Plan prepared with F01–F32, backend gates, common API/UX
  contract and acyclic dependencies.
- [x] Existing React/Vite/TypeScript/npm starter and health-request cleanup
  documented in [UI guidance](../../ui/AGENTS.md) and [README](../../ui/README.md).
- [ ] Request and prepare the F01 `frontend_foundations` detailed plan before code.
- [ ] Establish locked component/hook/HTTP-fixture/browser/coverage tooling in F01;
  no frontend test runner/E2E scripts exist today.
- [ ] Prepare later requested child materials with screen/action-to-operation/
  permission mapping and their full success/failure/boundary inventory.

## 2. Ordered slice checklist

### Wave A — Foundations, access and administration

- [ ] F01 `frontend_foundations` — API/validation/format/routing/test seams,
  accessible primitives and common-state tests pass. Requires: existing UI starter.
- [ ] F02 `authentication` — seven auth actions, refresh/session/re-login/reset
  behavior pass component and real API/browser tests. Requires: F01.
- [ ] F03 `application_shell` — live-grant menus/guards/deep links/denied states,
  account-cache cleanup and error recovery pass. Requires: F02.
- [ ] F04 `user_groups` — list/detail/forms/delete/reference conflicts,
  permissions and stale-edit recovery pass. Requires: F03.
- [ ] F05 `users` — group/lock/profile/admin-reset forms, safe passwords/CI email
  errors and session-change UX pass. Requires: F04.
- [ ] F06 `permissions` — registry/grants/precondition modes/changed grants and
  forbidden recovery pass. Requires: F05.
- [ ] F07 `audit_logs` — authorized filters/list/detail/correlation and safe
  before/after rendering; no edit/delete controls. Requires: F06.

### Wave B — Master data and dealers

- [ ] F08 `districts` — forms/state/capacity/reference errors, permissions and
  concurrent-edit recovery pass. Requires: F03.
- [ ] F09 `agency_types` — limit/state/delete forms and blocking-agency display
  use authoritative responses, not client-only limits. Requires: F03.
- [ ] F10 `units` — fraction policy/state/delete restrictions and recorded unit
  meaning represented correctly. Requires: F03.
- [ ] F11 `business_rules` — capacity/rate forms preserve exact strings/source
  constraints/ETags/blockers. Requires: F08, F09.
- [ ] F12 `products` — unit/threshold/state/search/detail/server-price/stock
  display, no authoritative editable balances. Requires: F10, F11.
- [ ] F13 `agencies` — profile/type/district/delete/termination/balance and
  duplicate-name selection flows pass. Requires: F08, F09, F11.

### Wave C — Workbench and goods/cash core

- [ ] F14 `document_workbench` — draft header/lines/kind permissions/preview vs
  posted data/parent ETags/stable intent keys pass. Requires: F12, F13.
- [ ] F15 `inventory` — stock/ledger/date/effective-entry views show authoritative
  opening/running balances and safe empty/error states. Requires: F14.
- [ ] F16 `stock_receipts` core — draft/header/lines/post/draft cancel and posted
  snapshots pass; posted correction deferred. Requires: F15.
- [ ] F17 `stock_issues` core — draft/READY/zero-upfront post/no-money pending
  replacement pass; money/correction integration deferred. Requires: F16.
- [ ] F18 `payment_receipts` core — manual debt draft/post/draft cancel and server
  allocation results pass; posted correction deferred. Requires: F17.
- [ ] F19 `upfront_payments` + issue integration — evidence/consume/separate
  receipt states preserve received-money outcomes. Requires: F18.
- [ ] F20 `receivables` — overview/balance/settlement/statements/allocations
  distinguish original remainder and current outstanding. Requires: F19.

### Wave D — Counts, returns, credit and providers

- [ ] F21 `stock_adjustments` core — signed-delta/reason/draft/post/cancel UI
  shows stock-only outcomes without sales/new price. Requires: F16.
- [ ] F22 `stock_counts` — snapshot/actual observations/recount/confirm/zero
  differences and conditional permission pass. Requires: F21.
- [ ] F23 `sales_returns` core — source lines/quantities/original price/rounding/
  debt-credit outcomes pass; no fake refund. Requires: F20.
- [ ] F24 `agency_credit` — lot/source/statements/available-vs-reserved/shared
  balances pass; full refund integration deferred. Requires: F23.
- [ ] F25 `credit_applications` core — draft/post/unreserved-credit/debt results
  show zero new cash; posted correction deferred. Requires: F24.
- [ ] F26 `online_payments` — checkout/poll/reconcile/events/late full success
  display; browser redirect never proves payment. Requires: F24.
- [ ] F27 `refunds` — source/draft/reserve/manual-confirm/attempt/reconcile/
  retry/cancel UI preserves UNKNOWN reserved money. Requires: F25, F26.

### Wave E — History, corrections and read products

- [ ] F28 `document_history` — kind-aware search/versions/lines/source navigation
  and authorized historical HTML/PDF print pass. Requires: F14, F22, F27.
- [ ] F29 `document_corrections` + owning-module completion — reasons/full
  replacement/blocked-dependency/posted flows pass. Requires: F28.
- [ ] F30 `reports` — five reports/filters/totals/pages and authorized full-filter
  exports pass. Requires: F29.
- [ ] F31 `dashboard` — authorized monthly/current-vs-period sections,
  unreceipted money and top limits pass. Requires: F30.
- [ ] F32 `chatbot` — read-only queries/agency selection/clarification/unsupported/
  forbidden/unavailable states pass. Requires: F31.

## 3. Deferred integration and full-module closure

- [ ] Stock receipts close after F16 + F29 and M15 + M29; correction/cancel and
  dependent stock/price refresh tested.
- [ ] Stock issues close after F17 + F19 + F29 and M17 + M19 + M29: upfront,
  evidence separation, pending replacement and posted correction/cancel.
- [ ] Manual receipts/independent adjustments/returns/credit applications close
  after F29/M29 posted paths and affected-reader refresh tests.
- [ ] Agency credit's reserved/source/available displays tested with F27/M27
  refund UNKNOWN/failure/success/repeated reconciliation.
- [ ] Workbench/history supports all goods kinds/parent ETags; financial documents
  and historical versions cannot be edited as goods drafts.
- [ ] Confirmed count adjustments/paid refunds have no invalid edit/cancel action;
  stale buttons and direct navigation cannot bypass state/permission rules.
- [ ] Later integrations invalidate all affected list/detail/balance/history/
  report reads; stale money/stock/debt never presented as current.
- [ ] Child action/operation inventory has no required deferred API/browser/
  accessibility/backend gate left open before module completion.

## 4. Common gate for each implemented slice/function

- [ ] Requested child plan resolves screen/action/state/permission/API ownership
  and runtime readiness before code.
- [ ] Actual component/hook/function/adapter/validator/callback symbols have
  passing meaningful success/failure/boundary and async cleanup/race cases.
- [ ] Source-derived schema-valid fixtures and remote JSON validation tested;
  TypeScript types alone never authorize remote data.
- [ ] Mocked progress separated from real HTTP/browser evidence; mocks cannot
  prove backend persisted-state/rollback/concurrency behavior.
- [ ] Exact numbers/IDs/dates/password bytes preserved; server snapshots/balances
  authoritative, no optimistic ledger/money success.
- [ ] ETag/parent version/precondition/intent key/204/errors/Retry-After handling
  tested; duplicate or uncertain retries cannot create new money intent.
- [ ] Auth refresh/grant changes/deep links/account cleanup tested; wrong-password/
  forbidden responses cannot create infinite refresh or stale-account leaks.
- [ ] Required live critical flows pass in browser against the appropriate backend
  operations; missing requested setup fails rather than silently skips.
- [ ] Scoped statement/branch coverage declared and met; required skipped/xfailed/
  unrun tests leave items open. Foundations/auth proposed gate is 100%.
- [ ] Keyboard/focus/labels/announcements/dialog recovery/responsive behavior
  verified; snapshots or mocked callbacks alone are insufficient.
- [ ] Safe rendering/logging/validation, no secret/raw-token dumps; reset fragment
  handling follows agreed auth design.
- [ ] Exact test nodes/commands/results/coverage/browser evidence recorded in
  child VERIFICATION before per-function completion.

## 5. Integrated system acceptance

- [ ] Real login/me/refresh/logout/change/reset/expired/locked/forbidden scenarios
  pass; account data cannot survive identity switch or late responses.
- [ ] Changed permissions affect menu/actions/rejection recovery/deep links,
  including kind policies and conditional count/issue-cancel rights.
- [ ] Stale form edits preserve work through 412/428 review/reload; parent ETags
  keep header/line details consistent.
- [ ] Receipt/issue/manual/upfront flows show confirmed results; failed stock post
  keeps VERIFIED money visible until separate receipt handling succeeds.
- [ ] Return/credit/refund provenance/remaining/reserved/available and UNKNOWN
  recovery cannot create unverified money movement or a second payment.
- [ ] Checkout/redirect/timeouts/late success reflect server state only; retries
  reuse the intent and existing resource for reconciliation.
- [ ] Count stale snapshot/recount/zero-difference/immutable confirmation pass,
  including movement that returns to same stock quantity.
- [ ] Posted correction blockers/history/original-period changes refresh affected
  readers and remain understandable to the operator.
- [ ] Authorized snapshot print/full-filter export and dashboard/chatbot permissions,
  period semantics, ambiguity/error recovery pass.

## 6. Verification and release

- [ ] `npm ci`, typecheck/lint/format/build pass from `ui/` using the
  [verification workflow](../../.agents/workflows/verify.md).
- [ ] F01-established component/hook/fixture/browser/coverage scripts pass;
  actual script names/environment documented before use.
- [ ] Required direct/proxied browser/deep-link/CORS/header scenarios pass;
  production-build smoke evidence separated from static build success.
- [ ] UI/README/AGENTS/public templates match implementation; no backend/provider
  credentials or business tokens tracked.
- [ ] Both general plans/checklists and child evidence updated; backend operation
  readiness confirmed through actual backend results, not a plan file alone.
- [ ] Intended release modules fully closed or explicitly partial; missing APIs
  never silently replaced by demo data/success placeholders.

## 7. Evidence and blockers register

Use separate rows for contract-mocked and live-integrated results. Link exact child
evidence only once the requested plan exists; no nonexistent child-folder links
or invented browser results. Marking "mocked" never closes a live slice checkbox.

| Slice / module | Delivery level/scope | Child evidence / exact command result | Backend gate / blocker |
| --- | --- | --- | --- |
| F01 frontend_foundations | General roadmap ready; no child plan/code | Planning validation only; no frontend behavior tests run | Request detailed foundations plan/test harness. |
| F02–F32 | Roadmap only | No child implementation/browser evidence | Frontend prerequisites and actual owning backend operations required. |

Current next action: request F01's detailed plan. This general checklist creates
no child module and marks no business component/hook/adapter complete.
