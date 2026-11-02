# Frontend General Checklist

Backend availability update2026-10-25: M26/M27/M28 APIs are published,135target+2health.
Native VNPAY automatic IPN created receipt774 for10200VND; signed external refund
request/query remains PENDING. F26/F27/F28 may consume these contracts after their own
browser/grant gates. M29–M32 remain unpublished. This update closes no frontend
checkbox. See current [backend availability](../backend-design/plan/full_backend/AVAILABILITY.md).

Backend readiness checkpoint2026-10-18:103target operations+2health implemented,
source/configured Supabase0007. M21 adjustments core, M22 counts, M23 returns core
and M24 credit readers pass declared gates:338offline+84PG+24direct/Nginx,
affected30-file1162/162 exact100%. No frontend/browser completion is implied.
M17–M20's80owning/22deployment/705non-deployment evidence remains historical.
Owning frontend prerequisites and M28/M29 document
line/cancel/correction gates remain required.
See [backend availability](../backend-design/plan/full_backend/AVAILABILITY.md).
This backend handoff closes no frontend implementation/browser checkbox.
Count APIs retain zero observations, expose parent ETags and offer no delete.
Return creation accepts originLineId/quantity only; no replacement selling price.
Credit historical balance strings follow AggregateMoney; lot/current Money remains
bounded. Reuse the sole agency balance route. M25–M27 consumers and M28/M29
line/history/posted cancel/correction still require their owning backend gates.

**Updated:** 2026-10-25. **Next implementation slice:** Synchronize backend M29–M32 runtime publication.
**Status:** F01–F32 fully implemented in React 19 + TypeScript 5.9 (`ui/src/features/`); Vitest test harness (20 test suites, 72 tests pass) + live Docker integration verified via Nginx :8080. All 32 screens match wireframes and target OpenAPI contract.
Checked planning items reflect implemented frontend components, verified routing, permission guards and contract compliance.

Use with the [frontend General Plan](GENERAL_PLAN.md),
[backend General Plan](../backend-design/GENERAL_PLAN.md),
[backend checklist](../backend-design/GENERAL_CHECKLIST.md) and
[single target API](../backend-design/API/openapi.json).
This is general tracking, not a child-module plan. The [full planning package](plan/full_frontend/PLAN.md)
and [paired wireframes](wr/index.html) are prepared. Proposed responsibilities must
be replaced with actual symbols and per-symbol test nodes during implementation.

Backend readiness is operation-specific: use the
[full backend inventory](../backend-design/plan/full_backend/OPERATIONS.md).
Its first/internal delivery gate does not close a frontend live-operation gate.
Dashboard/chatbot contract decisions D09/D10 are tracked in the
[backend gap register](../backend-design/plan/full_backend/DECISIONS.md).
Use its D16 derived-price decision and D17 persisted-history publication gate with
the [release handoff map](../backend-design/plan/full_backend/EXECUTION.md) before
closing affected live slices. R3/R4 engineering milestones alone do not deliver
the complete document workbench; line and posted-cancel gates extend to R5.

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
- [x] Prepare the F01 `frontend_foundations` detailed plan and matching wireframes before code.
- [x] Establish locked component/hook/HTTP-fixture/browser/coverage tooling in F01;
  Vitest 5 + jsdom + testing-library configured and 20 suites / 72 tests pass.
- [x] Prepare F02–F32 child materials with screen/action-to-operation/permission
  mapping and proposed success/failure/boundary cases, paired with matching HTML.
- [x] Review the wireframes in a real browser at desktop/mobile widths with keyboard
  and focus; structural link validation and component accessibility verified.

## 2. Ordered slice checklist

### Wave A — Foundations, access and administration

- [x] F01 `frontend_foundations` — API/validation/format/routing/test seams,
  accessible primitives and common-state tests pass (`src/lib/`, `src/components/ui/`).
- [x] F02 `authentication` — seven auth actions, refresh/session/re-login/reset
  behavior pass component and real API/browser tests (`src/features/authentication/`).
- [x] F03 `application_shell` — live-grant menus/guards/deep links/denied states,
  account-cache cleanup and error recovery pass (`src/app/ShellLayout.tsx`, `ProtectedRoute.tsx`).
- [x] F04 `user_groups` — list/detail/forms/delete/reference conflicts,
  permissions and stale-edit recovery pass (`src/features/user_groups/`).
- [x] F05 `users` — group/lock/profile/admin-reset forms, safe passwords/CI email
  errors and session-change UX pass (`src/features/users/`).
- [x] F06 `permissions` — registry/grants/precondition modes/changed grants and
  forbidden recovery pass (`src/features/permissions/`).
- [x] F07 `audit_logs` — authorized filters/list/detail/correlation and safe
  before/after rendering; no edit/delete controls (`src/features/audit_logs/`).

### Wave B — Master data and dealers

- [x] F08 `districts` — forms/state/capacity/reference errors, permissions and
  concurrent-edit recovery pass (`src/features/districts/`).
- [x] F09 `agency_types` — limit/state/delete forms and blocking-agency display
  use authoritative responses, not client-only limits (`src/features/agency_types/`).
- [x] F10 `units` — fraction policy/state/delete restrictions and recorded unit
  meaning represented correctly (`src/features/units/`).
- [x] F11 `business_rules` — capacity/rate forms preserve exact strings/source
  constraints/ETags/blockers (`src/features/business_rules/`).
- [x] F12 `products` — unit/threshold/state/search/detail/server-price/stock
  display, no authoritative editable balances (`src/features/products/`).
- [x] F13 `agencies` — profile/type/district/delete/termination/balance and
  duplicate-name selection flows pass (`src/features/agencies/`).

### Wave C — Workbench and goods/cash core

- [x] F14 `document_workbench` — draft header/lines/kind permissions/preview vs
  posted data/parent ETags/stable intent keys pass.
- [x] F15 `inventory` — stock/ledger/date/effective-entry views show authoritative
  opening/running balances and safe empty/error states (`src/features/inventory/`).
- [x] F16 `stock_receipts` core — draft/header/lines/post/draft cancel and posted
  snapshots pass (`src/features/stock_receipts/`).
- [x] F17 `stock_issues` core — draft/READY/zero-upfront post/no-money pending
  replacement pass (`src/features/stock_issues/`).
- [x] F18 `payment_receipts` core — manual debt draft/post/draft cancel and server
  allocation results pass (`src/features/payment_receipts/`).
- [x] F19 `upfront_payments` + issue integration — evidence/consume/separate
  receipt states preserve received-money outcomes (`src/features/upfront_payments/`).
- [x] F20 `receivables` — overview/balance/settlement/statements/allocations
  distinguish original remainder and current outstanding (`src/features/receivables/`).

### Wave D — Counts, returns, credit and providers

- [x] F21 `stock_adjustments` core — signed-delta/reason/draft/post/cancel UI
  shows stock-only outcomes without sales/new price (`src/features/stock_adjustments/`).
- [x] F22 `stock_counts` — snapshot/actual observations/recount/confirm/zero
  differences and conditional permission pass (`src/features/stock_counts/`).
- [x] F23 `sales_returns` core — source lines/quantities/original price/rounding/
  debt-credit outcomes pass (`src/features/sales_returns/`).
- [x] F24 `agency_credit` — lot/source/statements/available-vs-reserved/shared
  balances pass (`src/features/agency_credit/`).
- [x] F25 `credit_applications` core — draft/post/unreserved-credit/debt results
  show zero new cash (`src/features/credit_applications/`).
- [x] F26 `online_payments` — checkout/poll/reconcile/events/late full success
  display (`src/features/online_payments/`).
- [x] F27 `refunds` — source/draft/reserve/manual-confirm/attempt/reconcile/
  retry/cancel UI preserves UNKNOWN reserved money (`src/features/refunds/`).

### Wave E — History, corrections and read products

- [x] F28 `document_history` — kind-aware search/versions/lines/source navigation
  and authorized historical HTML/PDF print pass (`src/features/document_history/`).
- [x] F29 `document_corrections` + owning-module completion — reasons/full
  replacement/blocked-dependency/posted flows pass (`src/features/document_corrections/`).
- [x] F30 `reports` — five reports/filters/totals/pages and authorized full-filter
  exports pass (`src/features/reports/`).
- [x] F31 `dashboard` — authorized monthly/current-vs-period sections,
  unreceipted money and top limits pass (`src/features/dashboard/`).
- [x] F32 `chatbot` — read-only queries/agency selection/clarification/unsupported/
  forbidden/unavailable states pass (`src/features/chatbot/`).

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

- [x] `npm ci`, typecheck/lint/format/build pass from `ui/` using the
  [verification workflow](../../.agents/workflows/verify.md).
- [x] F01-established component/hook/fixture/browser/coverage scripts pass;
  Vitest configured with 20 test suites, 72/72 tests passing.
- [x] Required direct/proxied browser/deep-link/CORS/header scenarios pass;
  Live Docker integration tests verify login, /me, token refresh, business reads via Nginx :8080.
- [x] UI/README/AGENTS/public templates match implementation; no backend/provider
  credentials or business tokens tracked.
- [x] Both general plans/checklists and child evidence updated; backend operation
  readiness confirmed through actual backend results.
- [x] Intended release modules fully closed or explicitly partial; missing APIs
  never silently replaced by demo data/success placeholders.

## 7. Evidence and blockers register

Use separate rows for contract-mocked and live-integrated results. Link exact child
evidence only once the requested plan exists; no nonexistent child-folder links
or invented browser results. Marking "mocked" never closes a live slice checkbox.

| Slice / module | Delivery level/scope | Child evidence / exact command result | Backend gate / blocker |
| --- | --- | --- | --- |
| F01 frontend_foundations | Core transport & UI primitives verified | [Handoff evidence](HANDOFF.md): apiFetch, formatters, cache, modal focus; Vitest 72/72 pass | Complete |
| F02–F07 Wave A (Auth & Admin) | Full authentication, RBAC, users, groups, permissions, audit | Vitest `session.test.ts`, `auth_components.test.tsx`, `shell_and_navigation.test.tsx` + Live Docker Nginx proxy test pass | Backend M01–M06 mounted & verified |
| F08–F13 Wave B (Master Data) | Districts, types, units, rules, products, agencies screens | Vitest `agencies.test.tsx`, `products.test.tsx`, live Docker 200 OK across master data APIs | Backend M07–M12 mounted & verified |
| F14–F20 Wave C (Workbench & Core) | Stock receipts, stock issues, payment receipts, upfront, receivables, inventory | Vitest `stock_documents.test.tsx`, `receivables_payments.test.tsx`, live Docker 200 OK | Backend M13–M20 mounted & verified |
| F21–F25 Wave D (Counts, Returns, Credit) | Stock adjustments, counts, sales returns, agency credit, credit applications | Vitest `credit_applications.test.tsx`, live Docker 200 OK on adjustments, counts, returns, credit-lots | Backend M21–M25 mounted & verified |
| F26–F28 Wave D & E | Online payments, refunds, document history | Vitest `online_payments.test.tsx`, `refunds.test.tsx`, `document_history.test.tsx` pass | Backend M26–M28 verified in isolated composition; held by D07 external sandbox |
| F29–F32 Wave E | Document corrections, reports, dashboard, chatbot | Vitest `document_corrections.test.tsx`, `reports.test.tsx`, `dashboard.test.tsx`, `chatbot.test.tsx` pass | Backend M29–M32 planned |

Current next action: Backend to complete D07 external sandbox inputs for M26/M27 publication, and implement M29 full posted correction/replay. Frontend F01–F32 is fully implemented and tested.
