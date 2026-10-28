# Full backend planning verification

## M29 internal goods/manual cash — 2026-10-25

Actually passed572defaultoffline,27unique owningPG(16goods+11manual) and12retainedPG
(2goods+10M16). A repeated migration ID and repeated protection IDs are counted once.
Current affected scope9files/310statements/76branches exact per-file100%; full details,
commands, actual failed fixture and corrected rerun, JUnit and coverage artifacts:
[M29 VERIFICATION](../document_corrections/VERIFICATION.md). Ruff lint/format pass.
Two independent review workers hit quota; no independent review success is claimed.

Source head0008; configured runtime stays0007/135target+2health. No routes published,
live migration/restart, new runtime/database or provider action. Existing-container
ordinary live integrity passes411documents/30agencies/24products. Original receipt774
is retained. Internal progress does not close M29 or R5/R6; next zero-upfront issue.

## Native VNPAY/M26–M28 publication — 2026-10-25

Current runtime135target+2health;27M26/M27/M28canonical operations are mounted.
Native2GETprovider transports are reachable outside business Swagger accounting.
Source/configured head0007. Automatic provider IPN for payment37/10200VND created
one receipt774 and one event. Live411documents/30agencies/24products; original seeded
documents were preserved. Native external refund15714325/5000VND request/query are
verified but remain05/PENDING; terminal bank settlement remains an open release item.

Current evidence:568offlinepassed;40unique selectedPG(18M26+11M27+11M28), with2native
nodes rerun/superseding the sameIDs;6unique direct/proxy/public deployment cases pass.
Declared27-file packet/config/API scope1783statements/408branches exact per-file100%:
M26=754/190,M27=517/100,M28=333/78,config121/40,API58/0. Ruff/build/health and Nginx
configuration pass. Exact commands/artifacts and local standards/specification review
are in [M26 current evidence](../online_payments/VERIFICATION.md). No unrun whole-suite,
external paid-refund or whole-release completion claim. M29–M32/R5/R6 remain open.

## 2026-10-24 — M25–M28 engineering packet and gated handoff

M25 core is mounted. M26 online payments, M27 refunds and M28 document history have
their complete operation branches implemented and verified in the isolated composition.
**Normal publication remains held by D07 accepted-provider/prerequisite gates.** The
user confirmed the external environment is not ready. Controlled HTTP fixtures and
seeded DEMO_SANDBOX evidence are not accepted external-provider deployment evidence.

### Actual tests, unique current nodes and precise coverage

| Selection | Passed cases | Scope |
| --- | ---: | --- |
| Complete default/offline backend selection |432| Includes all new contract, exact-value, signature, configuration, real-HTTP transport/deadline and renderer cases. |
| M25 owning PostgreSQL |14| Neutral drafts, FIFO/original cash, exact/one-over, rollback, competing applications/reservation winners and real grant-wait authorization. |
| M26 owning PostgreSQL |16| Durable TX1/restart, late full success, callbacks/reconcile both winners, unknown commit, setup recovery, original seeded events and coherent callback/page snapshot. |
| M27 owning PostgreSQL |11| Manual/online, both cancel/payment winners, both actual M25-application/M27-submit winners, source limits, UNKNOWN, fresh-revision retry, actor attribution, grants and rollback. |
| M28 owning PostgreSQL |11| Seven persisted kinds, four goods dispatchers, scoped readers/cursors, complete parent tokens, historical snapshots, count protection, rollback and observed authorization wait. |
| Retained M16/M24 PostgreSQL |29|25settlement+4agency-credit; full-seed financial replay and immutable reserved/paid sources included. |
| Retained migration/seed/integrity node |1| Fresh/populated upgrade, supported downgrade/re-upgrade, repeated seed and regression/snapshot preservation at0007. |
| Isolated direct/Nginx deployment |4|2M25+2controlled-provider/refund/history/HTML/PDF workflows. |

Thus **82 selected real-PG cases** passed(52owning+29retained+1migration), alongside
432offline and4deployment: **518 unique selected cases**. This is a checkpointed union,
not a fresh run of all historical PostgreSQL/TLS suites or the older705-case baseline.
Current collection was independently compared with passing setup/call/teardown IDs;
no required skip/xfail/unrun ID remains in the declared selections.

| Exact affected Python production scope | Files | Statements | Branches | Each file |
| --- | ---: | ---: | ---: | --- |
| M25 credit_applications |6|117|4|100% |
| M26 online_payments |7|531|126|100% |
| M27 refunds |8|514|100|100% |
| M28 document_history |7|333|78|100% |
| Changed/new shared production |4|337|32|100% |
| **Combined affected production** |**32**|**1832**|**340**|**exact100%** |

The4shared files are app/api/router.py, app/core/config.py,
app/modules/document_core/schemas.py and app/common/provider_commands.py. Every file
has zero missing/excluded lines, zero missing branches and zero partial branches in
coverage JSON. Unchanged production, test infrastructure and SQL text are outside this
Python scope; SQL behavior is established by real persisted-state/constraint tests.
No new Python/SQL migration was introduced; deployed0001–0007 snapshots are unchanged.

### Commands and resumable evidence

Working directory backend/. The existing approved helper below starts bounded workers,
sets SUPABASE_TEST_SCHEMAS=1, and preserves per-node JSON/log/raw-coverage files under
`C:\Users\23521\AppData\Local\Temp\opencode`. No PostgreSQL container/local database was used.

```powershell
uv sync --frozen
uv run --frozen --no-sync ruff check .
uv run --frozen --no-sync ruff format --check .
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-delivery-offline2 -m "not integration and not deployment" -q --tb=short -o faulthandler_timeout=180 --cov=app.modules.credit_applications --cov=app.modules.online_payments --cov=app.modules.refunds --cov=app.modules.document_history --cov=app.common.provider_commands --cov=app.core.config --cov=app.modules.document_core.schemas --cov=app.api.router --cov-branch --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-delivery-offline2-coverage.json
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-delivery-m26 tests/integration/online_payments -m integration -vv --tb=short --maxfail=1 -o faulthandler_timeout=180 --cov=app.modules.online_payments --cov=app.common.provider_commands --cov=app.core.config --cov-branch --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-delivery-m26-coverage.json
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-release-m27 tests/integration/refunds -m integration -vv --tb=short --maxfail=1 -o faulthandler_timeout=180 --cov=app.modules.refunds --cov=app.common.provider_commands --cov-branch --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-release-m27-coverage.json
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-m27-last-boundaries tests/integration/refunds/test_manual.py tests/integration/refunds/test_online.py -m integration -vv --tb=short --maxfail=1 -o faulthandler_timeout=180 --cov=app.modules.refunds --cov=app.common.provider_commands --cov-branch --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-m27-last-boundaries-coverage.json
uv run --frozen --no-sync python "C:\Users\23521\AppData\Local\Temp\opencode\agentra_verify_delivery.py"
uv run --frozen --no-sync python "C:\Users\23521\AppData\Local\Temp\opencode\agentra_final_coverage.py"
```

M25/M28 retained passing worker names and their exact selections are recorded in owning
VERIFICATION and the final evidence JSON. `agentra-m25-retained` passed29PG;
`agentra-packet-migration` passed its explicit master_data/test_migration node.
The first foreground final offline command hit the tool's120s window and is not counted;
agentra-delivery-offline2 completed432cases in229.28s. Passing artifacts are retained.

Final artifacts: agentra-delivery-evidence.json(current node inventory),
agentra-delivery-final-coverage.json, agentra-delivery-final.coverage and
agentra-delivery-final-coverage-summary.json in the approved temporary directory.

### Review findings and verified corrections

Standards and specification reviews ran separately. Concrete fixes covered by the
selected tests include shared financial detail schema nullability; independent-
connection rollback assertions; exact multi-lot/invoice cash provenance; UNKNOWN
optional-time serialization; original provider binding; pre-dispatch crash recovery;
terminal-proof conflicts; proper ACCEPTED/terminal reconciliation-result phases;
lost result-commit replies; setup/reconcile command identity separation; and creation
returning202 after a committed intent when checkout expiry is invalid.

A read-only staging check reproduced legacy demo-event projection failure, then passed
after the reader fix. The original immutable event JSON remains unchanged. A real
independent callback/page-query interleave also verifies PENDING filtering cannot
return a newly reloaded SUCCESS row. Total transport deadlines are tested against
regularly arriving slow chunks. No generic404 is accepted as definitive absence proof.

### Docker, Supabase, publication and frontend handoff

Frozen backend image build and backend-only Compose refresh passed. Backend/frontend
are healthy; direct8000 and proxied8080 liveness/readiness200. Normal runtime remains
**108target+2health**. Built-image HTTPX0.28.1, ReportLab4.5.1, writable/app/data with
TMPDIR=/app/data and Vietnamese NotoSans glyph coverage pass. The actual Linux PDF
response is text-extracted in the controlled direct/Nginx probe. Source-image hashes
for the payment service/adapter, refund protocol and renderer match the final source.

`uv run --frozen --no-sync alembic current`:0007(head).
`uv run --frozen --no-sync python -m app.db.verify --seeded --regression`:30table,
timestamp/document/ledger/cache/audit/report integrity and54SQLchecks pass. Live
410documents/30agencies/24products remain unchanged; auth_token62 reflects legitimate
runtime authentication activity and was not reset to a historical count. Fixture
cleanup used generated namespaces only. A proven-owned Windows-crashed M27 schema
pair was identified by worker time/data fingerprint and removed only after worker
exit/no active users. Root data/ and unrelated frontend work are preserved.

M25 five core operations are available to F25 after its prerequisites. M26 six, M27
twelve and M28 nine operations are verified in the isolated composition only; their
normal publication/frontend live handoff remains held by the user-confirmed D07
accepted-provider/prerequisite gate. Missing external inputs: accepted sandbox/service
identity and credentials, reachable public callback, key configuration and native-to-
canonical payment/refund/query/absence mapping. Controlled fixtures and DEMO_SANDBOX
cannot substitute for that evidence. No frontend browser gate is closed here.

**Next roadmap module: M29**, full posted correction/cancellation coordination.
All12M29-owned full operations remain deferred; R5/R6/full154-operation release stays
open. No commit/push, live reset, trigger disabling or balance-cache writes occurred.

## Active packet — 2026-10-23

M25 core implemented/reviewed/mounted:14owningPG+13offline,29retained M16/M24PG,
2isolated direct/Nginx. Exact per-file owning117statements/4branches and changed
document schema176/0; frozen/Ruff/build/live integrity54checks pass. Runtime
108target+2health, source/configured Supabase0007, live410documents/30agencies/24products
preserved. Evidence and durable checkpoints: [M25](../credit_applications/VERIFICATION.md).

M26 engineering remains unmounted/incomplete, D07accepted external sandbox unavailable.
Current full offline382passed/475deselected61.89s;31M26offline include controlled realHTTP
transport. Selected PG recovery/late-success/race/rollback/HTTP cases pass checkpointed
runs; exact module/changed-config coverage gate remains open. [M26](../online_payments/VERIFICATION.md).
M27 manual slice is internal work-in-progress; M28pending. No full packet completion.
New frontend changes are user work and preserved. No commits/push or SQL migration.

## 2026-10-18 — M21–M24 packet verified and deployed

Prepared each owning six-file plan before its code, in M21→M22→M23→M24 order;
confirmed HTTP/service/persistence/concurrency seams and registered actual symbols.
The packet adds23complete operations:5adjustment,10count,5return,3credit readers.
Runtime is **103/154target+2health**. M21/M23 internal draft cancellation is tested
but full public cancel/correction stays M29. Shared document lines/history remain M28.

Owning evidence: [M21](../stock_adjustments/VERIFICATION.md),
[M22](../stock_counts/VERIFICATION.md), [M23](../sales_returns/VERIFICATION.md),
[M24](../agency_credit/VERIFICATION.md). Source/isolated/configured Supabase head0007.

### Actual test outcomes and precise scope

| Selection | Actual passing cases | Evidence |
| --- | ---: | --- |
| Default offline, all backend | **338** | Frozen command below; includes30new owning contract/rounding cases. |
| Four new owning real-PG suites | **29** | M21=8, M22=7, M23=10, M24=4; every current node has passing setup/call/teardown. |
| Retained M16 PostgreSQL | **25** | Full settlement suite, including full seed/all seven persisted kinds, protected money, rollback and observed races. |
| Retained M17–M20 PostgreSQL | **27** | Full workflows suite, mixed histories, headers/authorization, FIFO/upfront/receivable and races. |
| Affected older migration-head cases | **3** | Catalogues, shared commands and master-data fresh/populated/seed/down/up. |
| Isolated direct/Nginx deployment | **24** |22retained+2new complete adjustment→count→issue→cash→return→credit flows. |

Thus **84realPG** cases passed (29owning+55retained) and **446unique cases** were
verified in this packet's final union:338offline+84PG+24deployment. The new owning
scope is59cases (30offline+29PG). These are checkpointed/resumed outcomes, not a
claim that an interrupted monolithic command passed. No required skip/xfail/unrun
node remains in the declared packet/regression/deployment selections. The historical
705-case baseline and historical whole-code coverage remain historical; untouched
PostgreSQL/TLS suites were not rerun as a fresh whole-backend gate.

| Exact Python production scope | Files | Statements | Branches | Per-file result |
| --- | ---: | ---: | ---: | --- |
| M21 `app/modules/stock_adjustments/` |6|161|24|100%|
| M22 `app/modules/stock_counts/` |6|321|56|100%|
| M23 `app/modules/sales_returns/` plus new0007 Python revision |8|250|50|100%|
| M24 `app/modules/agency_credit/` |6|136|12|100%|
| Changed shared: `app/modules/settlement_core/repository.py`, `app/modules/document_core/schemas.py`, `app/api/router.py`, `app/db/manifest.py` |4|294|20|100%|
| **Combined affected production** |**30**|**1162**|**162**|**exact100%**|

Every file independently has zero missing/excluded statements and zero missing/
partial branches. M23 module-only is240/50; its new migration contributes10/0.
Owning total is868/142. SQL guard behavior is verified by real state/adversarial/
migration tests, not represented as Python coverage of SQL text. Verification
infrastructure, unchanged production and older immutable Python revisions are outside
this deliberately declared production scope.

### Exact commands and resumable checkpoints

Working directory backend/, locked existing environment:

```powershell
uv sync --frozen
uv run --frozen --no-sync pytest -m 'not integration and not deployment' -q --tb=short --cov=app.modules.stock_adjustments --cov=app.modules.stock_counts --cov=app.modules.sales_returns --cov=app.modules.agency_credit --cov=app.modules.settlement_core.repository --cov=app.modules.document_core.schemas --cov=app.api.router --cov=app.db.manifest --cov-branch --cov-report=term-missing --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-final-offline-coverage.json
```

Frozen sync audited56packages. Offline result338passed in61.92s,444integration/
deployment deliberately deselected **at that checkpoint**; later additions were
integration-only and all are included in the explicit84-node final inventory.

`agentra_checkpoint.py start <name> <pytest arguments>` is the approved temporary
worker used below. It sets SUPABASE_TEST_SCHEMAS=1, PYTHONUNBUFFERED=1 and a distinct
COVERAGE_FILE, starts a bounded selected worker, and saves setup/call/teardown and
current-node progress to `<name>.json`, log to `<name>.log`, raw coverage to
`<name>.coverage`. Source selections without this explicit opt-in still require
guarded disposable test URLs. No Docker/local database was created.

Owning exact commands are in the four linked logs. The actual retained commands:

```powershell
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-retained-settlement1 tests/integration/settlement_core/test_posting.py tests/integration/settlement_core/test_replay.py tests/integration/settlement_core/test_provenance.py -m integration -vv --tb=short --maxfail=1 -o faulthandler_timeout=180 --cov=app.modules.settlement_core.repository --cov-branch --cov-report=term-missing --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-retained-settlement1-coverage.json
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-retained-settlement2 tests/integration/settlement_core/test_reservations.py tests/integration/settlement_core/test_guards.py tests/integration/settlement_core/test_races.py -m integration -vv --tb=short --maxfail=1 -o faulthandler_timeout=180 --cov=app.modules.settlement_core.repository --cov-branch --cov-report=term-missing --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-retained-settlement2-coverage.json
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-retained-workflows1 tests/integration/workflows/test_issues.py tests/integration/workflows/test_receipts.py tests/integration/workflows/test_upfront.py tests/integration/workflows/test_receivables.py tests/integration/workflows/test_races.py tests/integration/workflows/test_history.py tests/integration/workflows/test_review_regressions.py -m integration -vv --tb=short --maxfail=1 -o faulthandler_timeout=180
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-retained-workflows2 tests/integration/workflows/test_authorization.py tests/integration/workflows/test_boundaries.py tests/integration/workflows/test_guards.py tests/integration/workflows/test_isolation.py tests/integration/workflows/test_pages.py tests/integration/workflows/test_remaining_boundaries.py -m integration -vv --tb=short --maxfail=1 -o faulthandler_timeout=180
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start agentra-retained-head7 tests/integration/catalogues/test_history.py::test_fresh_populated_upgrade_seed_repeat_and_catalogue_history tests/integration/shared_api/test_foundations.py::test_command_constraints_and_downgrade_blocker tests/integration/master_data/test_migration.py::test_populated_upgrade_seed_regression_and_snapshot_preservation -m integration -vv --tb=short --maxfail=1 -o faulthandler_timeout=180
```

Final retained workers pass14+11+11+16+3PG cases. Source-final owning/data checkpoints
are `agentra-final-m21`, `agentra-new-auth`, `agentra-fractional-stock`,
`agentra-post-wait-auth-fixed`, `agentra-final-m22-lifecycle`,
`agentra-final-m22-persisted-boundaries`, `agentra-final-count-http`,
`agentra-m23-guards2`, `agentra-final-m23-http`, `agentra-final-unchanged-return`,
`agentra-m23-protected-fix`, `agentra-return-current-head`, `agentra-migration-coverage`,
`agentra-final-m24`, `agentra-credit-history-fixed` and `agentra-credit-range-boundaries`.
Duplicated nodes across these checkpoints count once.

The final coverage and independent collection/node comparison actually ran:

```powershell
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_combine_final.py" agentra-final-m21 agentra-final-m22-lifecycle agentra-final-m22-persisted-boundaries agentra-final-count-http agentra-post-wait-auth-fixed agentra-m23-guards2 agentra-final-m23-http agentra-final-unchanged-return agentra-final-m24 agentra-credit-history-fixed agentra-retained-settlement1 agentra-retained-settlement2 agentra-migration-coverage
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_verify_final_evidence.py"
```

The first asserts30files and exact per-file coverage, output1162/162, all missing/
excluded/partial counts0. The second compares current collection against complete
passing phases for all84PG and24deployment IDs, outputs338/84/24 and saves the full
node inventory. Reports are `agentra-m21-m24-final-coverage.json`,
`agentra-m21-m24-final.coverage` and `agentra-m21-m24-final-evidence.json` under the
approved `C:\Users\23521\AppData\Local\Temp\opencode` directory. Passing coverage
files are kept when combined. These are session artifacts, not runtime dependencies.

### Migration, review and deployment

Concrete0006 reproduction: paid3VND sale, late2.5-unit return3VND, reserve1VND,
insert earlier0.5-unit return1VND. The late successor should be2VND with sufficient
backing, but old revision-key ownership rejected it. Reviewed0007 permits current
POSTED same-return successors to replenish original immutable lots; M16 maps both
lot metadata and consumed-refund keys to current effective return revisions. Stored
lot/sourceRevisionId/originReceiptId and refund evidence remain immutable. Reserved
and paid cases both pass; other-source/kind/agency guards stay intact. Fresh0007,
populated0006→0007, seed twice,54SQLchecks and downgrade/re-upgrade preserve all data.
M24 also concretely reproduced historical credit1.2e18/current7e17; canonical/runtime
historical balance fields now use AggregateMoney without widening stored/current/lot Money.

**Standards review:** scoped to the four newly introduced modules and their shared
edits, preserving unrelated pre-existing dirty work. Atomic line-PATCH body/ETag,
historic snapshot overwrite and protected lot findings were fixed. Reviewer confirmed
source closure, including migration ordering/qualification/downgrade, with no further
high-impact finding.

**Specification review:** protected lot, snapshot and unhandled stock-overflow findings
were fixed and regression-tested. Reviewer confirmed closure and correct complete-
ledger-before-display filtering. Runtime boundary tests additionally found and fixed
draft-date comparison after model serialization. Fixture-only actor/delivery/termination
setup errors were corrected and exact nodes resumed. An initial120s interrupted
worker and earlier failing attempts are not passing results; all authoritative final
workers exit0. Remote stacks and PostgreSQL activity were inspected; no silent long
Wait-Process command or mock concurrency substituted for observed real blocking.

Actual Docker/root commands:

```powershell
docker compose build backend
docker desktop start
docker compose --profile tools run --rm migrate
docker compose up -d --wait --wait-timeout 120
docker compose ps
docker compose exec -T backend alembic current
docker compose exec -T backend python -m app.db.verify --seeded
```

Docker Desktop had been stopped on the user's follow-up; the first migration attempt
failed to connect to its pipe and changed no database state. Desktop was started,
reviewed0007 explicitly applied, and backend/frontend recreated healthy. Frontend image
was built automatically because its local image was absent. Current migration0007head;
direct liveness/readiness/Swagger, Nginx health and proxied readiness each200. Live
verifier passes30tables/timestamps/document/ledger/cache/audit/report integrity with
410documents/30agencies/24products,8users,17auth tokens and3740audit rows preserved.

Disposable deployment command:

```powershell
.venv\Scripts\python.exe "C:\Users\23521\AppData\Local\Temp\opencode\agentra_checkpoint.py" start-script agentra-deployment-run "C:\Users\23521\AppData\Local\Temp\opencode\run_agentra_m21_deployment.py"
```

This seeds only a generated Supabase namespace and runs the built API plus Nginx on
disposable loopback18000/18080, timeout90s. It runs24real direct/proxy cases through
the same image and removes only its two containers and generated schema afterward.
Normal backend/frontend remain healthy at8000/8080. No provider credentials invented.

### Cleanup, quality and handoff

After all workers exited, guarded cleanup removed the exact UUID schema and metadata
left by the initial interrupted M21 case, verified by its fixture marker. Independent
read-only query now reports **zero generated domain and metadata namespaces**, head0007
and preserved410/30/24 live counts. Post-cleanup live seeded integrity verification
passed again. Only normal backend/frontend containers remain. No commit or push.

Frozen sync56packages, Ruff lint and370-file format check pass. Quiet Compose
validation, `git diff --check`, unchanged tracked0001/0002DDL check, and planning
validator pass (154operations,40backend/39frontend acyclic edges,3050OpenAPI refs).
All original0001–0006SQL snapshots were left unchanged by this packet.

M21 core, full ten-operation M22, M23 core and M24 readers close their declared
roadmap scopes. E13/E14 and M24's reader part of E15 pass; M25 owns the rest of E15.
**Next:** expand M25 credit_applications' owning plan. M28/M29 generic history/lines
and full posted correction/cancel, M25–M32 and full R4–R6 remain open. Frontend readiness
is operation-specific; no frontend implementation/browser checkbox is closed here.

## 2026-10-17 M17–M20 completion and retained regression closure

Four owning plans were prepared before code and test seams explicitly confirmed.
M17 stock_issues core, M18 payment_receipts core, M19 upfront_payments and M20
receivables add22complete operations. Runtime80target+2health; no new migration.
M28/M29 line/history/posted correction/cancel gates remain deferred.

- [M17 exact commands, rollback/race/review/deployment evidence](../stock_issues/VERIFICATION.md)
- [M18 evidence](../payment_receipts/VERIFICATION.md)
- [M19 evidence](../upfront_payments/VERIFICATION.md)
- [M20 evidence](../receivables/VERIFICATION.md)

**Owning run:**80passed (53offline+27realPG), exact100% over808statements/98branches,
every scoped file zero missing/excluded statements or missing/partial branches.
**Deployment:**22direct/Nginx cases passed using isolated Supabase schemas; remote
timeout90seconds. Disposable API/proxy removed after verification; no Docker DB.

**Runtime Supabase:**explicit `docker compose exec -T backend alembic upgrade head`
passed0002→0006, `alembic current`0006head. Live `python -m app.db.verify --seeded`
passed30tables/timestamps/document/ledger/cache/audit/report integrity, with existing
410documents/30agencies/24products. Demo login200, new collection reads200, logout204.
The latest backend image is running healthy on127.0.0.1:8000.

**Quality:**`uv sync --frozen` audited56locked packages; Ruff check passed;
format check301files passed. Offline selection
`uv run --frozen --no-sync pytest -m 'not integration and not deployment' -q --tb=short`
passed308cases,419deliberately deselected. The final two cases independently verify
maximum valid debt/credit and one-over storage rejection through the pure replay seam.
Plan validator passed154operations,40backend/39frontend edges and3050OpenAPI refs.

**Retained regression status:**the interrupted sequential whole-backend run is not
a passing result. It found an offline import compatibility issue (restored and
independently rerun) and older local-only concurrency deadlines on remote Supabase.
Explicit `SUPABASE_TEST_SCHEMAS=1` now scales test-event/deadline budgets; local
defaults stay unchanged, every race still observes real blocking and asserts final
state. The originally failing district lock-wait case passes after this adaptation.
Final outcome union is **370/370 current retained PostgreSQL/TLS nodes passed**:
access108, catalogues109, goods87, master66. Interrupted runs were resumed by exact
node ID, preserving passing results rather than repeating whole suites. A read-only
collection comparison confirmed all370current nodes have a recorded pass, without
omissions or duplicate counting. All final worker exit codes are0. No required
skip/xfail was used. Prior617-case *combined coverage* remains historical.

The completed current selection totals **705 non-deployment cases** across recorded
runs:308offline +397PG/TLS (370retained +27owning), plus22deployment cases. This is
a checkpointed/resumed result, not a claim that an interrupted monolithic command passed.

### Changed-production coverage closure

The M17–M20 owning80-case command above was retained unchanged. Additionally:

```powershell
$env:COVERAGE_FILE='C:\Users\23521\AppData\Local\Temp\opencode\agentra-m16-pure.coverage'
uv run --frozen --no-sync pytest tests/settlement_core -q --tb=short --cov=app.modules.settlement_core --cov-branch --cov-report=json:C:\Users\23521\AppData\Local\Temp\opencode\agentra-m16-pure-coverage.json --cov-report=term
```

**30passed** in-memory cases. Combining this data with the final25-case retained M16
PostgreSQL data gives M16 **477statements/208branches exact100%**. Combining those
with the M17–M20/shared owning data yields **33files,1285statements/306branches,
exact100%**, with zero missing/excluded statements or missing/partial branches in
every file. This deliberately scoped affected-production gate does not claim fresh
100% coverage for untouched backend or verification-infrastructure files.

Session orchestration/evidence commands were run from backend/ with the installed
frozen environment, using approved temporary scripts:
`run_agentra_retained_gate.py`, `resume_agentra_retained_gate.py`,
`finish_agentra_goods.py`, `agentra_verify_evidence.py` and
`combine_agentra_scoped_coverage.py`. Generated per-node manifests, progress JSON,
logs, final worker commands/results and coverage reports remain in
`C:\Users\23521\AppData\Local\Temp\opencode`.

### Cleanup and handoff

After every worker stopped, guarded cleanup removed22orphan UUID test/metadata
namespaces left by interrupted jobs. An independent runtime read before/after
confirmed head0006 and410documents/30agencies/24products preserved. Business fixtures
were never placed in the live dms schema; no Docker database was created.

M17/M18 core, M19 and M20, E11/E12 and the scoped R3 engineering milestone now close.
M17/M18 full-module posted corrections/cancel and M28 history/lines remain deferred
to their owning later gates. Next executable code is M21 stock_adjustments after
preparing its six-file plan. R4–R6/full154-operation destination remains active.

Final post-documentation checks also passed: Ruff lint,301-file format check,
quiet Compose validation, `git diff --check`, immutable0001/0002DDL no-diff check,
and plan validation (154operations,40backend/39frontend edges,120package documents,
485local link targets across130documents,3050OpenAPI references). Docker backend
is healthy; liveness/readiness/Swagger each return200 and `alembic current`0006head.
Post-cleanup live `python -m app.db.verify --seeded` passed again, and a read-only
catalog query confirmed **zero generated test namespaces remain**.

## Previous M04/E05 checkpoint — 2026-10-04

M04 and E05/M07–M09 locally complete: [exact commands/state/coverage](../users/VERIFICATION.md),
[districts](../districts/VERIFICATION.md), [types](../agency_types/VERIFICATION.md),
[units](../units/VERIFICATION.md). 207 offline +217 PG/TLS +16 direct/Nginx cases
pass; exact 100% scope (2173 statements/414 branches). Source/disposable head0005;
fresh/populated upgrades, seed twice, zero metadata drift and all54 SQL checks pass.
Twenty new full operations; [AVAILABILITY](AVAILABILITY.md) records32target+2health.
Actual callable registers are in the four owning TESTS documents. Next E03/M05;
R2–R6 and the full [GOAL](GOAL.md) remain open. Supabase deployment not performed.

Final root commands `python openwiki/backend-design/plan/full_backend/validate_plan.py`,
`docker compose --profile tools config --quiet` and `git diff --check` passed:
154 operations; 40 backend/39 frontend edges; 42 owning/program documents; 284 local
links across 52 documents; 3050 OpenAPI references. Validator's old pre-refactor
auth/model paths and migration/proposed-register assumptions were updated to the
actual source layout/head; historical checks below remain historical.

## Historical implementation checkpoint — 2026-10-03

E01/E02 and M03's part of E03 are locally delivered: 159 default offline, 105 PG/TLS,
eight built direct/Nginx cases, exact33-file100% (1460 statements/362 branches),
source/deployed disposable head0004 and all54 baseline SQL checks. No external
Supabase/provider deployment. Actual symbols, commands and state/race evidence:
[shared](../shared_api/VERIFICATION.md), [groups](../user_groups/VERIFICATION.md).
[GOAL](GOAL.md) remains active; [AVAILABILITY](AVAILABILITY.md) records12 target
operations plus2health. M04 users is next; R2–R6 remain open.

Read-only evidence validation from backend/:

```powershell
uv run python "C:\Users\23521\AppData\Local\Temp\opencode\validate_dms_backend_delivery.py"
uv run alembic heads
```

Passed: 33 declared files with zero missing/excluded statements/branches; 74 new
custom callable definitions named in owning registers; 16 docs/79 local links;
source-owned published IDs (12target+2health); source head0004. The temporary
validator is a session artifact, not a runtime/release dependency. Root quiet
Compose validation, git diff --check and unchanged tracked0001/0002 SQL checks pass.
Disposable deployed SQL verifier also passed after all smoke writes: 30tables,
60timestamps, 410documents, zero commands and54baseline checks; PostgreSQL16.15.

The sections below preserve the historical 2026-10-02 planning assessment.

## 1. Scope and inspected baseline

Planning prepared on **2026-10-02**, against branch `scaffold-project`, tracked
baseline `dd29752` plus the existing uncommitted authentication/schema/documentation
work. Initial `git status --short --branch`, `git diff --stat` and
`git log --oneline -8` were inspected. Existing user changes were treated as the
current project state.

Inspected: root/backend/UI guidance; backend factory, auth service/repository/models/
dependencies/errors/request context, sessions, migrations, seed/verifier and test
harness/evidence; actual UI App/API helper/package/proxy/setup; BA requirements and
legacy/extended sections, selected Q01–Q15 decisions, current DDL/DBML/read models,
target OpenAPI, both roadmaps/checklists and shared verification workflow.

Deliverables: complete operation inventory, current-state and requirement map,
architecture/replay/lock/retry design, 32 module work packages, decision register,
acceptance/race strategy, program checklist and detailed M02 plan. Source API and
runtime application behavior are not changed by this planning package.

## 2. Prior implementation evidence

[Authentication VERIFICATION](../authentication/VERIFICATION.md) reports 122 offline,
58 PostgreSQL/TLS and four direct/Nginx smoke cases with 100% scoped coverage.
Those are prior results, not commands rerun for this documentation task. Source
head is 0003; current external Supabase head and provider mail/sandbox operation
were not checked here.

## 3. Planning validation

Run from repository root:

```sh
python openwiki/backend-design/plan/full_backend/validate_plan.py
git diff --check
```

**Validation status:** passed on 2026-10-02. The read-only validator checks target
JSON/local references, exact operation ownership/method/path coverage, transport
metadata, source permissions, both roadmap graphs, checklist/module alignment,
static migration/model/auth declarations and delivery/acceptance/decision registers.
It does not validate future transaction algorithms by executing them.

| Check | Recorded result |
| --- | --- |
| Target operation inventory | 154 unique IDs, 28 API areas, 33 function codes; methods/paths and one owner each match. |
| Source transport matrix | 65 required JSON request bodies, 12 bodyless mutation actions, 57 If-Match operations, 1 If-None-Match operation, 42 idempotency-key operations; path bindings and required 428/409 responses checked. |
| Backend roadmap | 32 work packages, 40 acyclic edges matching table/Mermaid; module prerequisites and general checklist names match. |
| Frontend roadmap | 32 slices and 39 acyclic edges matching table/Mermaid; general checklist names and backend references match. |
| Static implementation baseline | Seven auth route IDs/methods/paths match target; 29 SQL tables, five identity ORM mappings and source migration chain ending at 0003. |
| Planning registers | 18 M02 responsibilities; 26 system acceptance scenarios; 14 concurrency scenarios; 17 decision/gap records; 22 delivery packets. These are test specifications, not executed business tests. |
| Markdown/OpenAPI references | 16 full-backend/shared-api documents; 156 local Markdown link targets across 26 documents; all 3050 local OpenAPI references resolve. |
| D16 arithmetic witness | Valid purchase `600000000000000000` × valid rate `2` = `1200000000000000000`, outside the source Money response pattern. Exact Decimal/source-pattern check only, not a PostgreSQL reproduction. |
| Validator lint/format | Ruff check passed; Ruff format check reports 1 file already formatted. |
| Whitespace | `git diff --check` passed; Git emitted line-ending conversion notices. New untracked plan Markdown is separately checked for trailing whitespace by the validator. |

Validator quality commands actually run from `backend/`, using the existing
installed locked-environment Ruff without changing dependencies:

```powershell
.venv/Scripts/ruff.exe check --no-cache --config pyproject.toml ../openwiki/backend-design/plan/full_backend/validate_plan.py
.venv/Scripts/ruff.exe format --check --no-cache --config pyproject.toml ../openwiki/backend-design/plan/full_backend/validate_plan.py
```

The first quality pass found an unused inventory loop binding and line-formatting
issues in the validator. They were fixed and both commands passed on rerun.

No new business API tests, PostgreSQL mutations, provider calls, frontend builds or
browser tests were run for this planning-only change. Required implementation
evidence remains open in the General Checklist and owning module checklists.

## 4. Remaining decisions

- D07: accepted deployed sandbox/provider and environment inputs, due M26/M27.
- D09: dashboard route admission versus per-section permissions, due M31.
- D10: safe chatbot candidate continuation for >25 matches, due M32.
- D16: derived selling-price response range and stored issue-price error policy,
  due before M10/M11 publication; exact arithmetic witness verified statically.
- D17: each writer's persisted-kind/replay coverage is an implementation and
  deployment gate, even when later kinds' HTTP writers have not shipped.
- Engineering migration/provenance choices have explicit proposed designs and
  reproduction gates in DECISIONS; source inspection is not passing runtime proof.

## 5. Deep-review additions in this session

The full-backend and M02 package already existed uncommitted when this task began.
This session independently inspected the implementation, selected requirements,
SQL guards/views, source API and actual UI integration, then refined that package:

- Added EXECUTION.md: E01–E22 packets, immediate M02 P0, migration ownership,
  mixed-history publication checks, complete-workflow R5 handoff and operational work.
- Added D16 with a reproducible numeric witness and a recommended dedicated quote
  schema; retained source-contract approval/update as an owning implementation gate.
- Added D17 so early backdated writers cannot ignore later kinds already seeded.
- Extended D10 for final one-candidate/empty continuation pages and preserved
  explicit disambiguation instead of interpreting page length as uniqueness.
- Added A25/A26; aligned work packages, general roadmaps/checklists, M02 numeric
  planning, READMEs and agent guidance. No business completion box was closed.
- Extended the read-only validator with transport, frontend graph, execution packet,
  model/migration baseline and price-witness checks; recorded the actual outputs above.

No application source, SQL migration, target API schema or UI behavior was changed
by this refinement. No fresh auth/runtime/DB/provider/browser verification was run;
M02 P0 remains the next implementation action.

## 2026-10-04 M05M06M10M12 completion

Five owning six-file plans prepared before code; M05 before M06, M10 before
M11/M12. All20 new operations pass full local gates, with no deferred operation
branches. M01–M12/R2 locally verified; source/disposable deployment head0006.
Availability is52/154target+2health; next E07/M13, full goal active/R3–R6 open.

### Exact commands and final results

From backend/, explicit guarded auth/business URLs use isolated PostgreSQL17
on loopback55434, per-test create/drop, never runtime DB fallback. Passwords are
omitted. Required integration runs have no skips/xfails.

| Command | Final result |
| --- | --- |
| `uv sync --frozen` | PASS,56 locked packages audited |
| `uv run ruff check .` | PASS |
| `uv run ruff format --check .` | PASS,199 Python files |
| `uv run pytest -q --tb=short` | **209 passed**,296 integration/deployment deliberately deselected at this checkpoint |
| `uv run pytest -m 'not deployment' --cov=app.modules --cov=app.common --cov=app.core --cov=app.api --cov=app.db.base --cov=tests.support --cov-branch --cov-report=term-missing --cov-report=json --cov-fail-under=100 -q --tb=short` | **492 passed**, including283 PG/TLS;18 deployment deliberately deselected; exact100% over2903 statements/484 branches |
| `uv run pytest tests/deployment -m deployment -q --tb=short` | **18 passed**, direct58005/Nginx58085 |

Default pytest was executed before the final five additional integration cases,
so its209 offline result is unchanged; its296 deselections are historical, not
the latest total. Combined final command above covers every final integration node.
Every owned/shared/prerequisite file independently has zero missing statements
and missing/partial branches. Individual owned scopes: permissions133/12,
audit109/16, rules82/4, products151/12, agencies218/24, each100%.

Disposable Compose file under the approved external temporary directory uses
synthetic local settings. From root,
`docker compose -f <temporary-config> --profile tools config --quiet`, `build`,
`up -d postgres --wait --wait-timeout 120`, explicit `run --rm migrate`,
`run --rm migrate alembic current` (**0006 head**),
`run --rm migrate python -m app.db.seed` (twice),
`run --rm migrate python -m app.db.verify --seeded --regression`, and
`up -d backend frontend --wait --wait-timeout 120` all pass. Seed first commits,
rerun verifies unchanged:410documents/30agencies/24products/30physical tables,
54SQL checks. Fresh/populated0005→0006/downgrade/re-upgrade and metadata retention
also pass in the integration suite. External Supabase was not migrated.

### Persisted/race/contract and review evidence

All20 new method/path/operation/parameter/schema/status/header/security/policy
contracts match canonical OpenAPI. Every new operation denies false/missing grants
and anonymous callers; seven actual lock-wait writer variants recheck live grants.
Permission pair creation/update and owning-group deletion pass both orders.
Audit filters/time ties/half-open dates/immutable rows/independent append pass;
exact actor/number JSON and nested provider credential sentinels pass real HTTP.
Cap/admission and master-inactivation/assignment pass both orders; opposing agency
moves, type/debt limits, permanent debt-preserving termination vs posting, same-key
termination and post-claim replay revocation pass independent connections.
Accepted-date/draft-history serialization passes both orders after reviewed0006.

D02's0005 cache/owner defect is reproduced, then0006 eligible cascade/rollback/
direct-cache rejection/reference races pass. First-use product/unit/delete,
draft/count/posted/canceled history and monotonic identities pass. D16 real receipt
6e17×2 returns1200000000000000000;1×.000001 returns0, with stored snapshots retained.
The canonical DerivedSellingPrice covers Product/InventoryChange; the tested
stored_selling_price seam rejects unusable issue prices without clamping.

Two-axis review findings were fixed and regression-tested: nested provider key
redaction, all BIGINT actor fields, exact nested JSON output, contact search,
post-claim replay authorization and acceptance/history-date serialization.
The old legacy-unit fixture now runs at0005 before upgrade; new invalid moves are
correctly denied at0006. Earlier failed checkpoints are superseded by final passes.
Owning actual-symbol registers and evidence: [M05](../permissions/TESTS.md),
[M06](../audit_logs/TESTS.md), [M10](../business_rules/TESTS.md),
[M11](../products/TESTS.md), [M12](../agencies/TESTS.md).

### Final documentation/review closure

`python openwiki/backend-design/plan/full_backend/validate_plan.py` passes154
operations,40 backend/39 frontend edges, all nine owning child six-file plans,
72 package documents/349 local links across82 documents and3050 OpenAPI refs.
It checks head0006 and both D16 quote projection refs. Root
`git diff --check`, `docker compose --profile tools config --quiet`, and
`git diff --exit-code -- backend/alembic/sql/0001_initial.sql backend/alembic/sql/0002_search_indexes.sql`
pass. Immutable initial deployed DDL has no diff. Both reviewers confirmed all
their original standards/spec findings resolved via source/projection checks;
the required application/PG/deployment evidence above is the executed authority.
Owning checklists close only these verified local modules; full R3–R6 remains open.

## 2026-10-05 M13/M14/M15 core completion

Three owning six-file plans before code; M13→M14→M15 verified.58/154 target+2
health published; E07/E08 pass, next E09/E10/M16. Deferred M28/M29 gates stay open.

### Exact commands and results

From backend/, guarded AUTH/BUSINESS test URLs use disposable PostgreSQL17 on
loopback55435, per-test create/drop, synthetic credentials and no runtime fallback.

| Command | Result |
| --- | --- |
| `uv sync --frozen` | PASS,56 locked packages |
| `uv run ruff check .` | PASS |
| `uv run ruff format --check .` | PASS,232 Python files |
| `uv run pytest -q --tb=short` | **219 passed**,365 integration/deployment deselected |
| `uv run pytest -m 'not deployment' --cov=app.modules --cov=app.common --cov=app.core --cov=app.api --cov=app.db.base --cov=tests.support --cov-branch --cov-report=term-missing --cov-report=json --cov-fail-under=100 -q --tb=short` | **564 passed (219 offline+345 PG/TLS)**;20 deployment deselected; exact100% (3622 statements/622 branches), no required skips/xfails |
| `uv run pytest tests/deployment -m deployment -q --tb=short` | **20 passed**, direct58013/Nginx58093 |

Every scoped file has zero missing statements/missing or partial branches.
M13=418/100, M14=97/14, M15=198/24 statements/branches, each100%; prerequisites retained.

Disposable Compose `<temporary-config>` in approved temporary directory: `config --quiet`,
`build`, `up -d postgres --wait --wait-timeout 120`, explicit `--profile tools run --rm migrate`,
`run --rm migrate alembic current` (**0006 head**), `run --rm migrate python -m app.db.seed`
twice, `run --rm migrate python -m app.db.verify --seeded --regression` (**54 checks**),
and `up -d backend frontend --wait --wait-timeout 120` pass. Combined tests retain
fresh/populated upgrade/downgrade/re-upgrade and zero ORM drift. No new revision
or external Supabase migration/deployment; initial SQL snapshots unchanged.

### Behavior and review evidence

All410 seed documents/411 revisions/7 kinds and24 product ledgers reconcile.
Drafts neutral; same-total line edits change parent ETag; all3 line mutations
reject READY/POSTED with unchanged persisted content/totals/ledger. Whole-ledger
atomic inventory balances precede display filters/keysets. D14's historical1.2e15/
current7e14 witness uses canonical AggregateQuantity; stored quantities remain bounded.

Receipts have five full operations and internal draft cancel. Snapshots, totals,
stock/cache/price source and durable result commit together. Real one-winner,
receipt/receipt, READY issue, edit/post discovery restart, master inactivation and
grant-revocation races pass. Backdated receipt on full money/history preserves
prior allocations/frozen sale prices. Definite failures roll back audit/command/
document/ledger effects. Direct/Nginx tests cover create/header/post/retry/statement.

#### Standards review

Scoped read-only reviewer found broad AuthError masking and missing direct frozen
line-mutation cases. Both reproduced/fixed; six added cases pass. Reviewer confirmed
both resolved; no remaining finding in reviewed scope.

#### Spec review

Independent reviewer reproduced401→403 masking after a reader wait. Any-of dispatch
now retries only403 FORBIDDEN; revoked401/Bearer and locked403 ACCOUNT_LOCKED pass
real PostgreSQL tests. Reviewer confirmed resolution with no remaining finding.

Full workbench/history/line dispatch is M28; receipt corrections/full cancellation
is M29. R3–R6/full goal remain open. Next prepare M16 six-file plan for E09/E10.

### Final documentation checks

Root `python openwiki/backend-design/plan/full_backend/validate_plan.py` passes:
154 operations/28 tags/33 permissions,40 backend+39 frontend edges,12 owning
child packages,90 package documents/397 local links across100 documents and3050
OpenAPI refs. Canonical D14 historical balance refs and D16 quote refs pass.
`git diff --check`, `docker compose --profile tools config --quiet`, and
`git diff --exit-code -- backend/alembic/sql/0001_initial.sql backend/alembic/sql/0002_search_indexes.sql`
pass. Root/backend guidance, README, General Plan/Checklist and latest active GOAL
now point to M16; prior dated handoffs retain their historical counts.

## 2026-10-11 M16 internal settlement completion

Prepared M16 six-file plan before E09/E10 code. Implemented pure FIFO/provenance,
seven-kind financial replay, caller-owned internal receipt/reservation services and
immutable replacement persistence. [Owning exact evidence](../settlement_core/VERIFICATION.md)
records state/rollback/observed races, full-seed immutable cash/history checks,
actual-symbol register and resolved independent standards/spec review findings.

From backend/: frozen sync56 packages, Ruff lint/format252 files and source heads0006
pass. Combined documented non-deployment coverage command: **617 passed,20 deselected**,
494.26s;247 offline+370 PG/TLS, no skip/xfail. Every scoped file is exact100%,
**4096 statements/830 branches**. M16 adds28 offline+25 PG,474 statements/208 branches.
No new migration or public route;58/154 target+2health remain published.

Direct/Nginx20-case evidence above is retained, not rerun for internal M16.
External Supabase/provider deployment not performed. Next M17 child plan/E11;
R3–R6, M23 return-line rounding and M27/M29 owning workflows remain open.

Final root planning validator passes96 package documents/420 local links across106
documents,154 operations,40 backend+39 frontend acyclic edges and3050 OpenAPI refs.
`git diff --check`, quiet Compose validation and unchanged immutable0001/0002
snapshot check pass. General/child trackers, root/backend guidance and frontend
availability handoff are aligned with M17 as next backend slice.
