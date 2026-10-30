# M31 Dashboard Verification

## Pre-Push JWT Review Fix - 2026-10-30

DashboardService now calls the existing cryptographic JWT decoder before opening
its dedicated connection; malformed/expired/signature-invalid tokens cannot cause
Supabase connection allocation or snapshot SQL. A valid token still undergoes
mandatory live session/version/grant authentication inside the same read-only
REPEATABLE READ transaction. Permission projection and the shared limiter are
unchanged. New tests execute the real decoder for all four cases and assert resource
and live-auth behavior; focused dashboard295cases pass7.81s.

Final whole-offline1088pass205.27s; dashboard is now163statements/24branches exact100%,
API68/0 and sharedresponses48/18 exact100%; full explicitly selected reports-inclusive
scope717/140exact. These replace only the affected source coverage, not historical
real-PG/race/deployment evidence. Docker Engine/local endpoints are unavailable and
no image was rebuilt: the October29 source/image match below is historical, not a
claim that this auth preflight fix is deployed. Exact commands/current limits are
in [program evidence](../full_backend/VERIFICATION.md).

## Completed And Published - 2026-10-29

User authorized completing existing M31 WIP and recording M32's AI API direction.
getDashboard is now mounted normally and deployed on existing dms. Runtime has
**153 of154 business operations plus2health** at source/image/configured Supabase
**0009**. Only queryChatbot remains unpublished. M29/M30 prerequisites are complete.
No canonical security policy/schema/DDL, settings/runtime dependency, cache, new
database/service/server, provider action, frontend build, commit or push was added.

Implementation keeps D09's exact six-grant admission and independent eight-grant
projection; omitted sections are not queried or serialized. Fresh AuthService
authentication/grants, shared HTTP limiter and all permitted metrics share one
dedicated read-only REPEATABLE READ transaction with one database asOf. The limiter
is bound by the HTTP dependency after auth/admission and before metrics; internal
projection tests have no HTTP request/limiter, never optional authorization. Pure
ProductSalesReportRow is reused from M30 schemas without reports.read inheritance.

### Full Offline And Exact Coverage

From `backend/`:

```powershell
$env:COVERAGE_FILE='../data/backend/m31-final-offline.coverage'
uv run --frozen --no-sync pytest -q --tb=short --junitxml=../data/backend/m31-final-offline-20261029.xml --cov=app.modules.dashboard --cov=app.api.router --cov-branch --cov-report=term-missing --cov-report=json:../data/backend/m31-final-offline-coverage.json
```

**1084 passed,639 integration/deployment deselected,177.05seconds**, six existing
dependency deprecation warnings. Of these291cases belong to dashboard, including
all256grant subsets, canonical constraints, exact large values, calendar boundaries,
serialization omission, cleanup and limiter behavior. All separately required PG/
deployment nodes below actually pass; deselection itself is not success evidence.

| Current production scope | Files | Statements | Branches | Per-file result |
| --- | ---: | ---: | ---: | --- |
| app/modules/dashboard/*.py |6|161|24|exact100% |
| app/api/router.py |1|68|0|exact100% |
| Explicit selection |7|229|24|exact100% |

Coverage JSON assertion confirms no missing/excluded lines or missing/partial branches.
M29/M30 older scope remains separately retained; this is not fresh whole-backend
coverage. Initial untouched WIP baseline290pass5.42s had166/22exact; reuse/limiter
changes account for the final161/24scope, so old line-offset coverage was not merged.

### Actual PostgreSQL: Fourteen Unique Nodes

All commands use explicit SUPABASE_TEST_SCHEMAS=1/current Supabase UUID schemas,
ordinary triggers/constraints and in-process TestClient, never a new database/server.
Selections were serialized. Current complete passing artifacts:

| Selected file under tests/integration/dashboard | XML in data/backend | Cases | Seconds |
| --- | --- | ---: | ---: |
| test_dashboard.py | m31-owning-pg-first-20261029.xml |4|528.93 |
| test_boundaries.py | m31-boundary-pg-20261029.xml |3|225.05 |
| test_replay.py | m31-replay-pg-20261029.xml |4|1051.84 |
| test_http.py | m31-normal-http-pg-final-20261029.xml |1|79.56 |
| test_money_boundaries.py | m31-money-boundaries-pg-20261029.xml |2|187.29 |

Each uses `uv run --frozen --no-sync pytest <file> -m integration --tb=short
--maxfail=1 --junitxml=<artifact>` (first/replay/boundary/money use `-vv`; finalHTTP
uses `-q --tb=line`). A reconciliation of these exact XML IDs asserts14unique nodes,
all completed with no failure/error/skip/xfail. This is a verified union of completed
selections, not an invented fresh all-green whole-PG-suite claim. Initial metric /
snapshot selections preceded the HTTP-only limiter fix; core query semantics did not
change, and final normal-app HTTP plus money witnesses execute current implementation.

Evidence includes empty no-write, inactive product/all-master count, strict low-stock
equality/zero thresholds, selected-month independence, independent sales/returns/net/
cash/receipt-header and current ledger oracles,12buckets and12tied entities yielding
deterministic top10. Four M29 owning workflows check January/February dashboard values
after every committed goods/manual-cash/issue/return/credit move/cancel. No raw report
query is called as its own oracle. Read-only25006 is observed, pool cleanup asserted.

Real two-connection barriers prove one pre-change observation while issue correction
and grant revocation commit between sections; the next request observes new policy.
A second barrier proves receivedAt evidence and real receipt cash cannot be omitted
or double-counted when separation commits between cash and evidence queries.

DP07 fixture creates a replacement while no verification exists, retains the original
frozen READY revision, then adds valid historical VERIFIED evidence under ordinary
SQL guards. Explicit old/current revision inequality and40VND January/0February
assertions detect accidental currentRevisionId-only joins. Public verified-money
replacement guards are unchanged. DP08 injects failed commit and compares persisted
domain/audit/command state and both monthly dashboards unchanged (excluding new asOf),
then retries a February issue consuming January money: Januaryunreceipted0/cash0,
Februarycash40 and exactly one automatic receipt.

Normal-app HTTP verifies six real single-grant projections, excluded-only403,
admitted-plus-alternative-reader200, schema/Cache-Control/request ID,401/422/429/500,
safe errors, unchanged domain snapshot and actual refresh-session revocation401.

### Failures And Independent Review

- Real HTTP429 initially returned200: dashboard's custom same-snapshot auth omitted
  the shared business limiter. Bound the existing limiter through the dependency;
  new unit regression and actualHTTP429/Retry-After/cleanup now pass. No grant policy
  or auth shortcut was introduced.
- The no-write snapshot initially included intentional group_permission fixture
  updates/audit rows. Capture its baseline after final deliberate grant mutation,
  before actual positive/error requests; read-only guarantees are not weakened.
- Independent reviewer identified missing DP07 older-revision and DP08 failed-post/
  cross-month witnesses, not production defects. Added the two realPG cases above;
  follow-up static review resolves both and finds no additional concrete issue.
- New fixture initially imported a nonexistent helper, then assumed get().headers
  instead of the existing Pydantic response/token helper, and used an unsupported
  draft business_date keyword. Corrected test construction; DRAFT date is set before
  freezing, with normal constraints. Final two-case XML is all-green.
- Deployment comparator initially expected nonexistent cash-report currentCredit.
  Current report contract exposes currentReservedCredit/currentAvailableCredit;
  compare their exact integer sum with dashboard currentCredit, not historical
  closingCredit. No production calculation or contract was changed for this failure.
- One overlong replay function reference was shortened via a module alias for Ruff;
  no scenario or assertion was removed.

### Existing Deployment And Live Preservation

`docker compose build backend` passes frozen dependencies. Existing service updated
with `docker compose up -d --no-deps --wait --wait-timeout 120 backend`. Image is
sha256:02a76e1b7c1a3d9216cb3de204cc195af850132bb9523ddfa85afe4e4901c08c.
All240Python app files match workspace/deployed SHA256 exactly. Frontend unchanged;
same persistent ngrok domain/upstream8000 and direct/proxy readiness remain healthy.

```powershell
$env:M31_DIRECT_URL='http://localhost:8000'
$env:M31_PROXY_URL='http://localhost:8080'
$env:M31_PUBLIC_URL=(Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels').tunnels[0].public_url
uv run --frozen --no-sync pytest tests/deployment/test_12_dashboard_publication.py -m 'integration and deployment' -q --tb=short --maxfail=1 --junitxml=../data/backend/m31-deployment-20261029.xml
```

**3 passed108.82s**: exact153business manifest/chatbot alone absent, real admin read,
canonical response, all six sections,12month sequence, exact M30 reconciliation,
current30agency/24product population, minimum/maximum calendar boundaries,
unauthenticated401/invalid422/wrong-method405AllowGET/CORS/private-no-store/requestID.
Only auth login/logout changes sessions; no live business write or provider call.

Explicit VNPAY_SMOKE_{DIRECT,PROXY,PUBLIC}_URL/payment37, M29_{DIRECT,PROXY,PUBLIC}_URL
and AUTH_SMOKE_{DIRECT,PROXY}_URL selectors run existing deployment09/10/shared smoke:
**8 passed320.90s**, `m31-retained-deployment-20261029.xml`. This verifies accepted
payment reads/history/printing, all corrections and browser errors on the same image;
it is not a rerun of every old M30 export or all historical deployments.

Existing-container `python -m app.db.verify` passes30tables, timestamps/document/
ledger/cache/audit/report integrity:411documents/30agencies/24products. A separate
read-only assertion preserves receipt774POSTED/10200ONLINE/DEBT_COLLECTION,
payment37SUCCESS/VNPAY/receipt774/10200 and exactly one event. No seed reset,
live monetary document mutation or external refund status claim was made.

### Handoff Boundary

M31 complete. Consumer D09: route admission is unchanged six-grant anyOf; individual
sections are independently projected, so do not grant route access to prepare-only
or receipt-post-only users. Current queue/balances/master counts are not historical
selected-month values. Period flows use Vietnam half-open months and effective
POSTED revisions. asOf links one response observation, not different HTTP requests.
Unauthorized fields are absent, not null/zero. Top10ties use stable IDs; trend pads
12ordinary months and truncates cleanly at supported minimum year1. All exact values
remain strings. Cache-Control is private,no-store; no dashboard-wide reports.read.

User-selected M32 AI API direction/remaining D10 and provider/privacy/error boundaries
are recorded in [HANDOFF](../../HANDOFF.md). No model/provider/key/settings or chatbot
implementation was added. Whole R5/R6/system/backup/restore/browser and external
terminal bank refund settlement remain separate/open. Historical entries below
describe older planning checkpoints, not current delivery status.

Final tooling: scoped Ruff lint passes; format check reports20files formatted.
Plan validator now includes dashboard's six owning documents and passes154unique
operations/32packages/40acyclicedges,187packagedocuments,689localtargets across197
documents and3050OpenAPIreferences. This validates planning consistency only, not
runtime behavior. Existing Docker services are healthy. Final direct/proxy/public
readiness is200with155total operations each (153business+2health); deployed source
parity and live data checks above are actual, not inferred from the plan validator.

## 2026-10-28 Planning-Only Inspection

This packet creates six owning Markdown files. No M31 production code, canonical
OpenAPI edit, M29/M30 change, DB connection, runtime request, service/server/container,
migration, dependency installation, commit or deployment is part of this task.
No functional test, PostgreSQL race, coverage percentage or module pass is claimed.

Inspected root and backend instructions, General Plan, full-backend PLAN,
REQUIREMENTS/DESIGN/MODULES/DECISIONS/GOAL and execution/operation references,
HANDOFF restrictions, verification workflow and exact canonical dashboard schemas.
Read-only source inspection also covered auth dependencies/current-user rechecks,
the current receivables snapshot projection, upfront evidence fields/transitions,
strict low-stock comparator, fixed Vietnam dates and initial SQL read models.
These are source facts, not live deployment checks.

### Contract Evidence

| Source location | Observed fact |
| --- | --- |
| `../../API/openapi.json:478` | Admission has six grants, excluding prepare and receipt-post; one required month parameter and modeled 200/400/401/403/422/429/500 paths. |
| `../../API/openapi.json:729-739` | Only month/asOf required at root; pending scalar permits post OR prepare; unreceipted scalar permits verify OR receipt-post; other sections have their own exact read grant. |
| `../../API/openapi.json:742-746` | Inventory/sales/receivables required children, max twelve trend points and ten products/agencies, nested AgencyDebtPoint uses bounded Money. |
| `../../API/openapi.json:714-715,721` | Minimal report identities and full ProductSalesReportRow fields, not full product/agency profiles. |
| [D09](../full_backend/DECISIONS.md#d09--dashboard-admission-versus-section-projection) | Selected source alignment retains exact six-grant admission plus independent section projection; earlier union proposal is not selected. |
| `../full_backend/EXECUTION.md:106,186` | E21/D09 names the decision gate; selected interpretation is recorded in D09, while implementation and publication evidence remain open. |

### Source Design Evidence

| Source location (repository-relative) | Reuse / constraint |
| --- | --- |
| `backend/app/modules/auth/dependencies.py:31-49` | Existing current-grant allOf/anyOf admission; group name is not authority. |
| `backend/app/modules/auth/service.py:157-179` | Claims/session/version authentication and current-user reauthentication can be reused inside a dedicated read snapshot. |
| `backend/app/modules/receivables/repository.py:10-63` | One-query moment/totals/page projection demonstrates existing exact current aggregates/minimal identities, not a ready-made dashboard. |
| `backend/app/modules/products/repository.py:24` | isLowStock uses strict currentStock < lowStockThreshold. |
| `backend/app/modules/upfront_payments/repository.py:9-22,93-102` | Evidence exposes receivedAt/state/receiptDocumentId; terminal consumption/separation records a receipt link. |
| `backend/app/common/dates.py:4-6,38-39` | Existing fixed Vietnam +07 helper; no new timezone dependency needed. |
| `backend/alembic/sql/0001_initial.sql:1406-1458` | Current revision and read models; effective POSTED sales/return business-date semantics. Immutable source, not edited. |

### D09 Outcome

The coordinator selected conservative source alignment under the user's implementation
request: preserve canonical six-grant admission and independently project existing
sections. Prepare-only and receipt-post-only callers receive 403; those grants still
authorize their section in a 200 response when a separate canonical grant admits
the caller. This resolves D09's interpretive ambiguity, not implementation or
publication gates. It is not user approval of a changed security policy: no permission
is expanded/removed and no MANAGEMENT bypass is introduced. Earlier alternatives
are not selected, and no canonical contract change is made.

Lack of approval for a security-changing alternative is no longer recorded as a
blocker to implementing existing canonical semantics. M29/M30 prerequisites and
all required M31 tests, coverage, runtime and publication evidence remain open.

Metric populations, evidence period, ranking and trend conventions are labelled
planning choices in REQUIREMENTS, not falsely attributed to exact source wording.
Month lexical/calendar edges require explicit implementation verification.

### Commands And Limits

`git status --short` was executed before editing and produced no output (clean
initial tree). Files were read with Read/Grep/Glob; all manual additions use
apply_patch. Final `git status --short --untracked-files=all` listed only the six
new dashboard files. Read confirmed the directory contains exactly those six names.
`git diff --check` produced no output, but does not inspect untracked file contents;
a separate Grep scan for trailing spaces/tabs in the new Markdown found no matches.
Local document links were checked against inspected source/document paths. This is
documentation-only review, not application verification. No backend test/build/DB/
deployment command was run for this packet; future commands in TESTS are intentionally
not evidence. A broad BA content search hit the tool's oversized-line limit; selected
business decisions and program traceability, rather than an uninspected BA excerpt,
are the cited business evidence here.

## Future Evidence Register

| Gate | Status / evidence required |
| --- | --- |
| D09 interpretation | Selected/documented: unchanged canonical admission plus independent sections; no implementation/test pass implied. |
| Prerequisite release | Open: latest full M29/M30 evidence and usable projection interfaces. |
| Actual-symbol register | Open: replace proposals with implemented symbols and exact success/failure/boundary nodes. |
| Offline / HTTP schemas and policy | Not run; DA01-DA12 required. |
| PostgreSQL / concurrent snapshots | Not run; DP01-DP12 required, UUID schemas in existing Supabase only. |
| Coverage / retained regressions | Not run; exact affected per-file statement/branch evidence and scope manifest required. |
| Existing-service deployment | Not run; complete authorized direct/proxy read-only evidence required. |
| Full M31 / R6 | Open; no pass or completion claim from this planning task. |

Append actual commands, node manifests, failures/resolutions, artifacts, source vs
deployed versions and remaining gates here during future authorized implementation.

## 2026-10-28 Source-Alignment Documentation Update

Updated only the six dashboard plan documents and the D09 section of
`../full_backend/DECISIONS.md` using apply_patch. The existing canonical OpenAPI and
production code are unchanged. The decision removes the stale approval blocker for
unchanged canonical behavior, not any M29/M30, test, coverage or publication gate.
No runtime, PostgreSQL, test, build, deployment or commit command was executed for
this update. The earlier planning-inspection command record above is historical,
not a claim that those checks were rerun during this documentation update.
