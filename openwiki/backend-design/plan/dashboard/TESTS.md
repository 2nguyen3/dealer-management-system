# M31 Dashboard Tests

## Current Actual Register - 2026-10-29

M31 is implemented/published. Final full offline1084pass includes291dashboard cases;
all14unique owningPG and3direct/proxy/public dashboard cases pass, plus8retained
deployment cases on the same image. Dashboard6files161statements/24branches and API
68/0 are exact per-file100% with no missing/excluded lines or partial branches.
Historical planning/isolated entries below do not describe current availability.

| Actual symbols | Passing success/failure/boundary evidence |
| --- | --- |
| schemas.validate_month/Month, service.month_bounds | Offline invalid/canonical/lower/upper/year-zero cases; realPG boundaries and deployed0001-01/9999-12,422invalid month. |
| DashboardResponse.projected and all owned child models | Offline exact aggregate/ID/money limits/required children,256permission subsets, realPG Decimal/strict schema and HTTP omitted-key checks. ProductSalesReportRow is now imported from reports.schemas, not duplicated. |
| DashboardService.__init__/get | All-subset matrix, fresh-auth/failure/cleanup tests, test_invalid_jwt_is_rejected_before_database_allocation (malformed/expired/signature-invalid tokens never allocate a connection; valid tokens still undergo live snapshot auth) and test_authenticated_business_limit_precedes_metrics_and_cleans_up; realPG permission/revocation, readonly25006,14node suite. |
| DashboardRepository.__init__/one/agencies/inventory/receivables/pending/verified | Actual driver/read-only tests, empty/current threshold/financial period/evidence oracles, real failed-post/old-revision/cross-month persisted witnesses and statement errors. |
| DashboardRepository.sales | Independent current-header/line oracles,12bucket zero fill,negative net,12tie top10,all4M29workflow replay nodes and real snapshot interleavings. |
| dependencies.get_dashboard_service | Existing engine binding unit test; normal-app realPG HTTP uses owned engine and shared limiter callback, no request-session authentication outside snapshot. |
| router.get_dashboard | Canonical complete constraints/response/status/header/policy parity, realPG6single grants+excluded403+combined200/401/422/429/500/revocation/no-write snapshot,3existing-service deployment cases. |

Actual PostgreSQL selections (all explicitly SUPABASE_TEST_SCHEMAS=1):

- test_dashboard.py:4cases, including independent metrics/ranking, verified Vietnam
  period/transitions/retries and real correction+grant multi-connection snapshot.
- test_boundaries.py:3cases, empty no-write, inactive/current threshold equality/zero
  independent of selected month and between-section receipt/evidence transition.
- test_replay.py:4parameterized M29 workflows, independent January/February sales,
  cash and receipt-header expectations after every committed move/cancel stage.
- test_http.py:1normal-app real-auth/schema/error/rate/revocation/read-only case.
- test_money_boundaries.py:2cases, frozen older-revision VERIFIED evidence and
  injected failed-post rollback followed by January-received/February-consumed money.

The last two close independent review's DP07/DP08 gaps without changing the public
verified-money replacement guard. Tests use ordinary constraints and an explicitly
valid historical SQL fixture; no cache writes, disabled triggers or provider calls.
All14unique nodes have completed passing XML evidence; attempts/fixes are recorded
in VERIFICATION. Rate and safe errors are not inferred solely from mocked unit tests.

## Historical Planning And Initial Isolated Register

Status: required future tests; none executed in this planning packet. Proposed
paths/symbols are not implemented artifacts. Required skips/xfails/unrun cases
cannot satisfy completion. Use independent expected values, not the production
query called again as its own oracle.

D09 expectations are selected, not pending a security-policy change: retain the
canonical six-grant admission and all independent section-reader rules. The cases
below verify that distinction without expanding/removing permissions or bypassing
checks for MANAGEMENT. No D09 behavior test is claimed executed by this decision.

## Proposed-To-Actual Register

### Isolated Actual Symbols - 2026-10-28

Unmounted implementation now exists under `backend/app/modules/dashboard/` with
offline cases in `backend/tests/dashboard/test_dashboard.py`. This register maps
the isolated slice only; it does not close DA01-DA12 in full, any DP gate, M29/M30
prerequisites, coverage, publication or M31. No PostgreSQL run was performed here.

| Actual symbol / model | Offline node names in test_dashboard.py | Still required |
| --- | --- | --- |
| `schemas.validate_month`, `Month`; `service.month_bounds` | `test_invalid_month_does_not_connect`, `test_month_bounds_calendar_edges`, standalone HTTP test | Real PostgreSQL year-10000 exclusive bound and Vietnam instant comparison; lower boundary fixture. Month remains required per current canonical parameter, no default. |
| `schemas.DashboardResponse.projected`; DashboardAgencies/Inventory/Sales/Receivables, MonthlySalesPoint, ProductSalesReportRow, AgencyDebtPoint | `test_schema_exact_numbers_limits_and_omission`, `test_nested_row_identity_and_numeric_storage_bounds`, all-subset test | Real driver Decimal/identity values and full required child-field failure matrix. |
| `service.DashboardService.__init__`, `.get` | `test_all_permission_subsets_exact_admission_and_projection` (256 subsets), `test_unrelated_grants_do_not_admit`, `test_snapshot_boundary_fresh_auth_and_next_request_revocation`, `test_failure_cleans_snapshot_and_never_returns_partial` | Real live auth/session/grant races, isolation/read-only enforcement, entire pre/post-commit coherence. |
| `repository.DashboardRepository.__init__`, `.one`, `.agencies`, `.inventory`, `.receivables`, `.pending`, `.verified` | `test_repository_every_metric_real_sql_and_bound_values` | Independent persisted counts/flows/cache/ledger/evidence oracles, join multiplicity and all terminal states. |
| `repository.DashboardRepository.sales` | `test_sales_sql_grouping_zero_buckets_exact_net_and_full_top_rows`, `test_return_only_period_negative_net_and_empty_products` | Real top-ten/ties/quantity/rounding and corrected-period reconciliation. |
| `dependencies.get_dashboard_service` | `test_owned_dependency_uses_existing_engine_without_request_session` | Actual application engine and read-session lifecycle in integration. |
| `router.get_dashboard`, standalone `router` | `test_standalone_router_required_month_exact_policy_and_http_omission` | Real authenticated in-process integration, required rate-limit/error paths, existing-service deployment after complete prerequisites. |

Boundary: `DashboardService(engine, settings, delivery).get(raw_bearer_token, month)`
opens its own connection with `isolation_level='REPEATABLE READ'` and
`postgresql_readonly=True` before beginning a transaction. It captures one database
`asOf`, authenticates and reloads grants using AuthService in that same Session,
then queries only authorized sections. No preauthenticated request Session is
modified. The feature owns bounded aggregate queries and does not depend on the
concurrently implemented ReportQueries or report HTTP authorization.

Offline commands actually executed from `backend/`:

```powershell
uv run --frozen --no-sync pytest tests/dashboard -q --tb=short
uv run --frozen --no-sync ruff check app/modules/dashboard tests/dashboard
uv run --frozen --no-sync ruff format --check app/modules/dashboard tests/dashboard
```

Latest offline result: 290 passed, 2 existing Starlette/httpx deprecation warnings,
5.37s; scoped Ruff check and format check report clean (7 Python files). Initial
run had 269 passed/12 failures/1 setup error: tests used `.status_code` instead of
existing exceptions' `.status` and lacked a local Settings fixture. Test-only
corrections produced 282 passed, then expanded identity/HTTP cases produced 290.
An intermediate format check flagged one Settings-call layout; corrected locally.
No coverage percentage, full module pass, runtime or deployment result is claimed.

The register below remains the full delivery requirement, not a completed checklist.

| Proposed responsibility | Planned success | Planned failure | Planned boundary |
| --- | --- | --- | --- |
| DashboardService constructor / dependency | Existing engine/session collaborators injected | Dependency failure releases resources | No network at import/startup; no extra engine/server. |
| Month/window parser | Vietnam month dates and twelve labels | Missing/malformed/impossible calendar month 422 | Dec/Jan, leap year, lower/upper years, no overflow. |
| Authorization/projection dependency | Each admitted single grant and mixed grants | 401 invalid/expired/revoked session; 403 no admission | False/removed grants, MANAGEMENT without grants, D09 excluded single grants. |
| Snapshot service method | One observation contains all allowed fields | Any query/model error aborts whole response safely | Revocation/receipt/correction concurrent with read. |
| Repository section methods | Reconciled aggregates | SQL error does not become partial 200 | Empty data, >10^18 sums, duplicate-join witnesses. |
| Trend/top-list builders, if separate | Exact shapes/order | Invalid numeric/model input rejected | Zero months, negative net, eleven ties -> ten. |
| Route / response serialization | Canonical 200 JSON | Safe modeled 400/401/403/422/429/500 | Unauthorized keys absent after actual HTTP serialization. |

At implementation, replace or expand each row with every actual module-qualified
function/method/validator/generated dependency and exact node IDs. Include any
introduced helpers, error mappers and read-session cleanup paths; do not mark this
proposed register as actual-symbol coverage.

## Offline / In-Process Matrix

| ID | Required assertions |
| --- | --- |
| DA01 | Parametrize all eight section-reader grants separately. Six canonical grants admit; prepare-only/receipt-post-only return 403 under selected D09 semantics. Assert exact key sets, not just status. |
| DA02 | Empty/unrelated/reports.read-only/false grants deny; no MANAGEMENT bypass. Enumerate all 256 subsets of the eight grants for admission and section-key projection using an independent policy oracle. |
| DA03 | For each excluded-only grant, add each canonical admission grant and assert 200 with its corresponding section and only other authorized sections. Revoke that extra admission grant on next request -> 403. |
| DA04 | sales.read without reports.read returns sales; debt.read without agency.read returns only minimal top-agency identities; inventory.read without product.manage works. |
| DA05 | Spy forbidden repository methods: never invoked, including when later serializer would omit keys. Mixed-user sequential requests share no models/cache. |
| DA06 | Match canonical required child fields, scalar kinds and maxItems; Id stays string, CatalogId stays integer, per-agency Money stays bounded, aggregate >10^18 remains exact. |
| DA07 | Missing month, whitespace, 2026-1, 2026-00/13 and duplicate query handling follow existing shared contract conventions; no current-month fallback. Calendar 0000 must be explicitly reconciled with lexical pattern before closing this gate. |
| DA08 | October UTC bounds, leap February and year rollover; 0001-01 trend contains only valid labels within maxItems; 9999-12 does not overflow in next-month bound construction. Never add an unapproved arbitrary year cutoff. |
| DA09 | Ordinary trend exactly twelve ascending months ending at requested month, zero buckets, return-only negative net, future requested month, last bucket equals headline. |
| DA10 | Top products have every ProductSalesReportRow field, aggregate before limit, gross sales rank, numeric ID tie-break (2 before 10), return-only/zero-amount activity. Top agencies positive debt/current rank; zero/one/ten/eleven tied candidates, max ten. |
| DA11 | No pagination/export/current reservation fields, contacts, evidence, hidden counts, None defaults or empty forbidden section stubs. Read 500/429 responses retain safe request/error headers. |
| DA12 | Dedicated read connection configured before first SQL; request auth session already active is not modified/committed. All queries/auth use dedicated snapshot; cleanup on success, auth/query/serialization failure. |

## Real PostgreSQL Matrix

Future execution must use the existing opt-in UUID-schema harness in the current
Supabase database with `SUPABASE_TEST_SCHEMAS=1`. Inspect fixtures first: no CREATE
DATABASE, new containers, services, servers, tunnels or live business mutations.
Independent concurrent connections inside the existing database are required.

| ID | Required persisted-state / concurrency evidence |
| --- | --- |
| DP01 | Empty fixture returns zero authorized counters/money and empty top arrays, with zero-filled trend. Read causes no domain/audit/command changes. |
| DP02 | ACTIVE/TERMINATED agencies and ACTIVE/INACTIVE products; low-stock below/equal/above threshold, threshold zero, fractional units; current counts unaffected by selected historical month. |
| DP03 | M29 original-period issue/receipt corrections and cancellations alter old month only; actual later returns/refunds affect their own months. Assert independent expected document and ledger totals, not merely M30 equality. |
| DP04 | Several lines/allocations per document, credit applications, refunds and automatic/manual/online/separated receipts. Full money counted once; sales returns/adjustments never purchase receipts or cash refunds. |
| DP05 | Current debt/credit vs selected month-end differ; current caches equal full-ledger sums, credit not netted against debt and active reservations do not reduce total currentCredit. Terminated debtor remains in top list. |
| DP06 | PENDING/READY issues across months count once; DRAFT/POSTED/CANCELLED and obsolete READY revisions excluded; unrelated pending REFUND excluded. |
| DP07 | VERIFIED/null-link evidence before/at/end of Vietnam receivedAt window; verifiedAt/issue businessDate deliberately different. Evidence retained on older issue revision still counted. CONSUMED/RECEIVED_SEPARATELY excluded. |
| DP08 | Consume and separate via owning services in isolated fixtures: exactly one receipt and terminal evidence link; failed posting rolls back; duplicate retry no duplicate money. Cross-month receipt proves no false per-month conservation assumption. |
| DP09 | Coordinated independent writer commits receipt+evidence transition between two dashboard section reads. Assert entirely precommit or entirely postcommit snapshot, never double count/missing amount. Use barriers/events, not timing-only sleeps. |
| DP10 | Concurrent correction commits after first read: headlines/trend/top rows/current caches all remain the same snapshot; next request sees entire corrected state. Do not establish coherence from matching timestamps alone. |
| DP11 | Grant removal/session/group invalidation committed between preliminary request auth and dedicated snapshot denies/projects using fresh auth. Removal after snapshot follows documented next-request semantics; no leaked keys on retry. |
| DP12 | Independent read-only enforcement rejects attempted DML in the read transaction; errors release session/connection. All fixture writes are confined to UUID schemas and leave live history untouched. |

## Coverage And Commands

Planned directories: `tests/dashboard`, `tests/integration/dashboard`; add a focused
case to the existing deployment suite only during authorized implementation. Do not
run the following selections until those tests exist and harness review is complete.

```powershell
# Future commands, working directory backend/; not run by this plan.
uv run --frozen --no-sync ruff check .
uv run --frozen --no-sync ruff format --check .
uv run --frozen --no-sync pytest tests/dashboard -q --tb=short
$env:SUPABASE_TEST_SCHEMAS='1'
uv run --frozen --no-sync pytest tests/dashboard tests/integration/dashboard -m 'not deployment' --cov=app.modules.dashboard --cov-branch --cov-report=term-missing --cov-report=json --cov-fail-under=100 -q --tb=short
```

Extend the coverage command to every actually affected shared/M30/auth/session
production file. Require exact 100% statements AND branches per file, zero missing
or partial branches, no new exclusion pragmas. Save exact node collection/results,
fixture failures and replacements, coverage scope/counts and artifacts in VERIFICATION.
Retain M29/M30 correction/report and auth/shared API regressions appropriate to changes;
do not repeat unrelated historical baselines solely to match old counts.

After implementation of selected D09 semantics and completion of prerequisites,
required policy tests and publication gates, verify authenticated
dashboard JSON at existing direct8000/proxy8080 using read-only requests, existing
authorized accounts and no grants/business writes in live data. Use in-process
fixtures for exhaustive grant/state branches. A TestClient case is not deployment
evidence. No fixture may launch another app/container or alter ngrok. Deployment
unavailability stays an open gate, not permission to create infrastructure.
