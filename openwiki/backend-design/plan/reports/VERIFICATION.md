# M30 Reports Verification

## Pre-Push Review Fixes - 2026-10-30

Resource and rendered-PDF tests now share a pytest-temporary artifact fixture;
the resource test generates successfully from an empty working directory and the
geometry test runs independently without ignored data or a prior test invocation.
Resource test passes1case; actual pdftotext/pdftoppm/Pillow geometry passes1case7.88s.

Actual PostgreSQL reproduced a double-rounding defect in the immutable source
sales_report expression: gross1000001000000000000/company2000000000000000001 gave
50.0001 rather than exact HALF_UP50.0000. The report-owned outer projection now
uses scaled integer `div` arithmetic and the unchanged full-company denominator;
no deployed SQL snapshot was edited. The new actual-PG expression node passes1case
with eight zero/full/fractional/below/tie/above/51-digit witnesses in an isolated
Supabase UUID schema (23.97s). The existing all-report source/ledger-oracle node also
passes1case243.29s on current SQL, including all five queries/full totals/filters
and company-denominator preservation. Exact commands are in the program evidence.

Final full offline1088pass205.27s, 640deselected, exact717statements/140branches for
reports+dashboard+API+responses; report production remains438/98exact. Ruff lint/
format pass. Docker Engine/local endpoints are unavailable: today's source changes
are not rebuilt/deployed; October29 publication evidence below is historical.
See [program evidence](../full_backend/VERIFICATION.md) for exact commands/scope.

## Complete M29/M30 Publication - 2026-10-29

All five report operations/fifteen media paths are published through normal app
composition on existing dms. Source/image/configured Supabase are0009; runtime has
**152 of154 business operations plus2health**. Only getDashboard/queryChatbot remain
unpublished. M29's twelve operations are also published. No live business mutation,
migration, seed/reset, provider action, new database/service/server or frontend build
was performed. User explicitly authorized restoring ngrok; its existing configured
domain and upstream8000 are unchanged.

### Final Offline And Coverage

From `backend/`:

```powershell
$env:COVERAGE_FILE='../data/backend/m29-m30-final-offline.coverage'
uv run --frozen --no-sync pytest -q --tb=short --junitxml=../data/backend/m29-m30-final-offline-20261029.xml --cov=app.modules.reports --cov=app.api.router --cov=app.common.responses --cov-branch --cov-report=term-missing --cov-report=json:../data/backend/m29-m30-final-offline-coverage.json
```

**1083 passed,626 integration/deployment deselected,200.43seconds**, six existing
dependency deprecation warnings. Reports contributes191passing offline cases.
No required owning PG/deployment node is considered passed merely because deselected.

| Explicit current production scope | Files | Statements | Branches | Per-file |
| --- | ---: | ---: | ---: | --- |
| app/modules/reports/*.py |8|438|98|exact100% |
| app/api/router.py |1|66|0|exact100% |
| app/common/responses.py |1|48|18|exact100% |
| Current selection total |10|552|116|exact100% |

JSON confirms no missing/excluded lines, missing or partial branches. M29's disjoint
22-file1124statement/196branch scope is separately retained/reconciled in its owning
VERIFICATION; it is not silently replaced by this offline-only scope.

### Actual PostgreSQL: All Eleven Unique Nodes

Every invocation used `SUPABASE_TEST_SCHEMAS=1`, current configured Supabase and
UUID schemas with in-process TestClient. No fallback CREATE DATABASE or live fixture.

```powershell
$env:SUPABASE_TEST_SCHEMAS='1'
uv run --frozen --no-sync pytest tests/integration/reports -m integration -vv --tb=short --maxfail=1 --junitxml=../data/backend/m30-owning-pg-resume-20261029.xml
uv run --frozen --no-sync pytest tests/integration/reports/test_readonly.py tests/integration/reports/test_replay.py tests/integration/reports/test_snapshot.py -m integration -vv --tb=short --maxfail=1 --junitxml=../data/backend/m30-owning-pg-remaining-20261029.xml
uv run --frozen --no-sync pytest tests/integration/reports/test_snapshot.py -m integration -vv --tb=short --maxfail=1 --junitxml=../data/backend/m30-owning-pg-snapshot-20261029.xml
```

These are resumed selections, not one fresh all-green run: first4nodes pass before
a fixture failure; next5nodes pass before a different fixture failure; final2snapshot
nodes pass438.42s. XML node reconciliation requires all11unique current IDs to have
completed passing results after superseding failed attempts; this assertion passes.
No required skip/xfail/interrupted node is counted. The eleven nodes cover independent
five-report field/totals oracles, historical1.2e15stock/current7e14 with inactive masters,
Vietnam boundary evidence, all M29 date-move/cancel/replay transitions, read-only
success/failure/disconnect snapshots, and server-observed in-flight SELECT snapshots
under date moves, reservation release and evidence separation.

After mounting and removing test-only router injection, the owning HTTP test was
rerun on normal app composition with resource stdout preserved:

```powershell
uv run --frozen --no-sync pytest tests/integration/reports/test_http.py -m integration -q --tb=short --capture=tee-sys -o junit_logging=system-out --junitxml=../data/backend/m30-normal-app-http-resources-20261029.xml
```

**1 passed175.06s**, overlapping the same eleven IDs, not a twelfth unique node.
Each report has exactly one projection statement:101rows except inventory102.
Actual query times0.976-1.047s; complete XLSX HTTP exports11784-12612bytes/2.446-2.454s;
PDF38417-47868bytes/2.709-2.919s. This measures this fixture/environment, not an SLA.
Canonical105row service/renderer-only resource artifact `m30-resource-measurements.json`
separately records XLSX12131bytes/0.300s/699282peakPythonbytes and PDF50020bytes/9.705s/
2982387peakPythonbytes. That query is mocked; no remote-query timing is inferred.
Both renderers are O(full-result), memory-only/no spool, without undocumented row caps.

### Rendered Output Inspection

```powershell
uv run --frozen --no-sync pytest tests/reports/test_pdf_geometry.py -m integration -q --tb=short --junitxml=../data/backend/m30-pdf-geometry-raster-20261029.xml
```

**1 passed2.96s** in the final artifact rerun. Actual pdftotext word boxes enforce text bounds and
non-overlap; actual pdftoppm raster images are read by Pillow to check ink remains
inside printable page margins; the bundled font maps every Vietnamese witness glyph.
Existing pypdf tests separately verify all source digits/text,105logical rows,
long-token/newline continuations, repeated record identity/headings/footer/totals.
Raw geometry artifact is `m30-fixed-geometry.html`; PDF/XLSX and rendered PNGs are in
data/backend. This is **automated inspection of actual rendered pages**, not human
visual review. Earlier worker/parent claims that the model saw PNG contents are
explicitly retracted; the model does not support image input. Page count/font
registration alone was not accepted as the rendered-output gate.

### Deployment, Runtime Role And Live Preservation

Locked `docker compose build backend` passes. Existing backend updated with
`docker compose up -d --no-deps --wait --wait-timeout 120 backend`; frontend unchanged.
Final image sha256:d94a321717b32ec8ea627a8ae2d3407c4e567a3d49a6a9fa0519a4237a5b0b85.
Final SHA256 reconciliation confirms all240app Python files in that running image
match the workspace exactly. Direct/proxy/public readiness each returns200and each
runtime manifest has154total operations (152business+2health); alembiccurrent0009head.
Initial parity attempt could not run because Get-FileHash is unavailable in this
PowerShell environment; the Python hashing comparison completed successfully instead.

Updated plan validator passes154uniqueoperations,32workpackages/40acyclicedges,
181packagedocuments/660localtargetsacross191documents and3050OpenAPIreferences.
The initial duplicate M29 row in the roadmap's current-work table was relabeled
without changing canonical slice IDs or dependency edges. Ruff lint/format and
git diff --check pass; Git reports informational LF/CRLF checkout warnings.

Explicit direct8000/proxy8080/public-ngrok URL selections use:

- `tests/deployment/test_09_packet_reads.py`:3pass on final image; original accepted
  payment37/receipt774/events and historical HTML/VietnamesePDF reads, no provider call.
- `tests/deployment/test_10_m29_publication.py`:3pass on final image; all twelve
  correction/cancel routes, unique canonical manifest and safe preconditions/auth.
- `tests/deployment/test_11_reports_publication.py`:3pass359.57s; all five JSON models,
  full pagination, exact all-row XLSX/totals and PDF values, invalid page controls ignored
  for binaries, error cases, safe attachments/request IDs/CORS and composed headers.
- `tests/deployment/test_shared_api_smoke.py`:2pass0.98s; direct/proxy browser/errors.

Artifacts `m29-m30-final-deployment-20261029.xml`,
`m29-m30-final-deployment-remaining-20261029.xml` and
`m29-m30-final-browser-20261029.xml` reconcile **all11unique cases passing** across
resumes. Earlier failures in these XMLs are superseded, not concealed or counted as
success. Final report/public and shared browser passes use the exact same image.
Set VNPAY_SMOKE_PAYMENT_ID=37, VNPAY_SMOKE_{DIRECT,PROXY,PUBLIC}_URL,
M29_{DIRECT,PROXY,PUBLIC}_URL, M30_{DIRECT,PROXY,PUBLIC}_URL, and
AUTH_SMOKE_{DIRECT,PROXY}_URL explicitly; the last two require127.0.0.1loopback URLs.

Existing-container `python -m app.db.verify` passes30tables and document/ledger/cache/
audit/report integrity with411documents/30agencies/24products. Read-only SQLAlchemy
assertions preserve receipt774POSTED/DEBT_COLLECTION/10200ONLINE and
payment37SUCCESS/VNPAY/receipt774/10200, exactly1event. No original monetary evidence
or live business row was changed. Auth login/logout alone produces test sessions.

### Failures, Corrections And Review

- Bulk fixture initially reused immediate deferred-constraint mode across goods
  receipts/issues; flush ordinary checks after each posted fixture, no guard disabled.
- ASGI disconnect fixture copied mixed-case HTTPX raw headers; normalize ASGI header
  names to lowercase so the real bearer header reaches authentication. Rerun passes.
- In-flight snapshot fixture initially shared an agency with a manual receipt;
  separating earlier evidence correctly caused PAYMENT_EXCEEDS_DEBT. Give the evidence
  witness an independent valid agency; no production payment/replay guard changed.
- Full-tree collection found namespace collisions in new report/dashboard tests;
  add empty package markers only, preserving dashboard implementation WIP.
- Old deployment expected404 for GET on a newly published POST-only correction route;
  correct to405. This exposed shared HTTP handler dropping the required Allow header;
  preserve framework headers while retaining generic safe error bodies. New regression
  plus required-precondition428 boundary closes response-file48/18exact coverage.
- CORS legitimately composes Vary:Accept,Origin; existing Nginx repeats nosniff.
  Tests require Accept membership and every security-header value to be nosniff,
  rather than incorrectly rejecting valid composed headers. No proxy/frontend edit.
- Initial deployment invocations omitted explicit legacy smoke variables; supply
  them rather than weakening required-environment checks. Superseding passes recorded.
- Independent read-only review found no additional high-confidence report defect;
  it confirmed the strengthened server statement barrier and continuation fix.

M30 is complete. M31 may reuse ReportQueries.statement and detached exact projection
contracts inside its own coherent section-authorized snapshot. Do not inherit
reports.read into dashboard, call public report routes, or claim M31/M32/wholeR6,
external terminal bank settlement or frontend browser completion from this evidence.

## Historical Work-In-Progress Evidence

## Evidence correction and serial PostgreSQL resume - 2026-10-29

M29 is fully published at147business+2health/0009; its prerequisite is closed by
[owning evidence](../document_corrections/VERIFICATION.md). M30 remains unmounted.
The reporting worker was interrupted by usage limits; parent confirmed no surviving
report pytest process before starting the complete11node owning PostgreSQL selection
with SUPABASE_TEST_SCHEMAS=1 in current Supabase UUID schemas. Completion, not partial
monitor output, is required before counting the selection as passed.

Correction: earlier parent claims of independent PNG visual inspection were invalid.
The image read tools returned attachments, but the parent model explicitly cannot
read image input. Parent rasterization of fixed pages1/14/15 succeeded, and actual
PDF text extraction/continuation tests pass; neither proves human visual inspection.
Do not cite parent as a visual reviewer. Required visual confirmation remains open
unless independently supported; no such confirmation is inferred from generated PNGs.

## Implementation Checkpoint: 2026-10-29

Source: eight existing WIP production files under `backend/app/modules/reports/`,
preserved and reviewed against all six owning plans/canonical contract. This worker
owns only reports production/tests/plans. Parent owns mounting, canonical contract,
deployment/general release docs; M29 worker has the exclusive PG slot. **No PG test
has yet run by this worker and reports publication is not claimed.**

### Completed Offline Evidence

Run from `backend/`, after verifying `../data/backend` exists:

```powershell
$env:COVERAGE_FILE='../data/backend/m30-owner-offline-final.coverage'
uv run --frozen --no-sync pytest tests/reports -q --tb=short --cov=app.modules.reports --cov-branch --cov-report=term-missing --cov-report=json:../data/backend/m30-owner-offline-final-coverage.json --junitxml=../data/backend/m30-owner-offline-final.xml
uv run --frozen --no-sync ruff check app/modules/reports tests/reports tests/integration/reports
```

Result: **190 passed**, zero failures/errors/skips/xfails, 64.50 seconds; two existing
FastAPI/Starlette deprecation warnings. Ruff passes. Initial fresh baseline was
182 passed/437 statements/98 branches; these are superseded overlapping tests,
not 372 distinct cases. A focused actual resource/HTTP selection also passed 16
cases; it overlaps this suite and is not added to the count.

Exact coverage JSON has no missing/excluded lines or missing/partial branches:

| File under app/modules/reports | Statements | Branches | Coverage |
| --- | ---: | ---: | ---: |
| __init__.py | 0 | 0 | 100% |
| dependencies.py | 8 | 0 | 100% |
| exporting.py | 168 | 66 | 100% |
| queries.py | 6 | 0 | 100% |
| repository.py | 39 | 6 | 100% |
| router.py | 60 | 6 | 100% |
| schemas.py | 96 | 0 | 100% |
| service.py | 61 | 20 | 100% |
| Total | 438 | 98 | 100% |

This is Python coverage, not evidence that the six SQL-string assignments executed
correctly against PostgreSQL. The actual-symbol registers in TESTS cover core,
transport, generated grants, cleanup and both renderers.

### Fixes And Actual Visual/Resource Evidence

- Added missing canonical `Content-Disposition` success-header metadata in the
  report router; the actual attachment already had this header. Offline schema
  assertion now checks the metadata.
- Actual PDF visual inspection found that `splitInRow=1` could orphan continuation
  text from its ID at a physical page split. Changed PDF chunks to max 120 characters
  and eight newlines, and `splitInRow=0`. Added a 100-line continuation regression.
  Text-only tests had not detected the visual defect; it was not hidden by weakening
  assertions. No query/source-contract change was needed.
- `test_resources.py` writes canonical 105-row cash-credit artifacts with Vietnamese
  `Dai ly Nguyen Anh`/`Don vi le` in actual accented Unicode, escaped markup/formula
  text, 1800-character token, and a 40-digit exact amount. Current files:
  `data/backend/m30-visual-cash.pdf` (50,020 bytes, 19 pages), `.xlsx` (12,131 bytes),
  and `m30-resource-measurements.json`.
- Measured with tracemalloc and coverage instrumentation: projection 0.0092s;
  XLSX 0.2319s/699,250 Python peak bytes; PDF 10.9573s/2,964,028 peak bytes. This is
  mocked-query/canonical-service plus actual rendering, not remote SQL timing or
  a performance SLA. Both renderers use memory-only buffers, not spooled disk files.
- `pdftoppm -f 14 -l 15 -scale-to 1800 -png data/backend/m30-visual-cash.pdf data/backend/m30-owner-fixed-visual`
  rendered pages14/15. The original claim of model visual inspection of PNGs was
  unsupported and is retracted. Successful rasterization alone was not accepted;
  the final automated rendered-output inspection above supplies measurable evidence.

### Pending Required Evidence

Implemented PG selection includes independent full-field five-report oracles,
actual 101+ populations/all ten exports, real M29 staged replay/date moves/cancels,
historical 1.2e15 inventory/current 7e14 with inactive masters, Vietnam midnight
evidence, server-observed in-flight two-connection snapshots, READ ONLY execution
and persisted-state/error/resource cleanup. These remain **NOT RUN** until the
parent explicitly releases the serialized PG slot; no elapsed wait substitutes
for that instruction. Parent-owned mount/direct/proxy/public/runtime-role gates
also remain open. No DB/container/service/server/tunnel/provider operation, live
fixture write, seed/reset, dependency change, commit or push by this worker.

The record below is historical planning evidence. Its statements that no code or
tests exist describe preparation only and are superseded by this checkpoint.

## Planning Record: 2026-10-28

Scope: prepare the owning six-file M30 plan only. No M30 code, dependency,
migration, canonical API edit, runtime publication or implementation test performed.
M29 full completion, M30, M31 and R5/R6 remain open.

### Sources Inspected

- Root AGENTS.md and backend/AGENTS.md; backend HANDOFF's current publication and
  existing-Supabase/existing-dms restrictions.
- GENERAL_PLAN.md and full_backend/{PLAN,MODULES,EXECUTION,DECISIONS,GOAL,DESIGN}.md,
  including M30/E20/D14 and M31's separate D09 boundary.
- API/openapi.json: five report paths/operation IDs, allOf permissions, required
  dates, filter/sort/page parameters, exact-value/identity/row/totals/response schemas,
  examples, three media types and declared response statuses.
- Immutable 0001_initial.sql report functions/current views, document/line/upfront/
  ledger/credit/reservation definitions and guard_ledger; reviewed 0007/0008/0009
  successor/admission SQL. No immutable file changed.
- Current inventory, receivables, agency-credit and settlement repository source;
  reversal_values, common exact values/schemas/dates/pagination, auth dependencies,
  document-history printing/font use, pyproject dependencies and API aggregator.
- M29 VERIFICATION's newest six-operation publication record and BM6/QD6 BA source.

### Static Findings

1. Existing sales_report/debt_report semantics can be composed with outer filters,
   full totals and paging; company gross must be computed before agency/type/page
   filters. current_document is not inherently POSTED-only.
2. Report inventory opening/closing fields remain bounded Quantity despite the
   earlier AggregateQuantity statement fix and recorded valid historical overflow.
   M30-RD01 is an open contract gate, not repaired or newly reproduced here.
3. Ledger reversals preserve original effective dates/orders; period classification
   must use source kind and signed net, never createdAt or sign-only buckets.
4. Same-return successor lots retain immutable source provenance, so credit history
   must follow entry.businessDate, not lot source-revision/creation timestamps.
5. Product-sales uses stored lineAmount including zero-VND cumulative returns;
   real cash uses complete current POSTED receipts/refunds, not allocation sums,
   credit applications, returns or duplicate provider evidence.
6. ReportLab/NotoSans exists; an XLSX writer is not declared in pyproject.toml.
   Its future selection/lockfile evidence remains open; no dependency installed.
7. No reports router is present in the inspected source aggregator. M30 methods,
   test nodes and export functions named in this plan are proposals only.

### Actions Actually Taken

Local file reads/searches and read-only Git inspection only, followed by apply_patch
creation of the six files listed below. Opening `git status --short` returned no
entries. Final `git status --short --untracked-files=all` also showed concurrently
appearing M29 financial test files and six dashboard-plan files; these were not
created, edited, staged or removed by this task. Static content search found no
trailing whitespace, conflict markers or checked implementation boxes in reports/.
These are documentation-preparation activities, not behavioral verification.

| File, under openwiki/backend-design/plan/reports/ | Delivered content |
| --- | --- |
| PLAN.md | Owning scope, operations, dependencies, planned seams and delivery gates |
| REQUIREMENTS.md | Canonical filter/schema/permission and report/export invariants |
| DESIGN.md | Static source findings, decision register, concrete five-query design and export lifecycle |
| TESTS.md | Planned symbols, success/failure/boundary cases, real ledger/snapshot and renderer gates |
| CHECKLIST.md | Unchecked implementation, integration, coverage and publication gates |
| VERIFICATION.md | This planning-only evidence record and explicit exclusions |

### Not Executed

No pytest, test collection, coverage, Ruff, plan-validator, application import,
database connection/query/migration/seed/verify, Docker/service command, readiness
request, HTTP/browser/export render, provider call, dependency installation or
lockfile update. No new database/schema/container/service/server/tunnel. No production
code, environment/credential, frontend, immutable SQL or existing tracker edits.
No commit, stage or push. This task cannot claim an M30 test pass or deployment.

## Future Evidence Ledger

All rows are deliberately NOT RUN. Replace them only with exact actual evidence
from separately authorized implementation, preserving failed-run explanations.

| Gate | Status | Required evidence |
| --- | --- | --- |
| M29 dependency completion | OPEN | Owning remaining operation/race/original-period/publication evidence |
| RD01 contract/aggregate alignment | OPEN | Actual witness, reviewed canonical refs and boundary tests |
| RD03 populations / RD06 XLSX decision | OPEN | Reviewed semantics, fixtures, dependency/locked build if selected |
| Actual-symbol implementation register | NOT IMPLEMENTED | Real files:symbols -> passing success/failure/boundary nodes |
| Five JSON report operations | NOT RUN | Canonical schemas, totals, independent query reconciliation |
| Ten binary report paths | NOT RUN | Full-filter logical row/totals parity, exactness/security/render evidence |
| Permission/error/cursor contracts | NOT RUN | AllOf x format matrix, safe statuses/headers and negative cases |
| Original-period M29 integration | NOT RUN | Independent raw source/ledger oracles across moves/cancels/replay |
| Multi-connection snapshot/read-only tests | NOT RUN | Actual synchronized concurrent commits and persisted-state comparisons |
| Resource/font/layout/cleanup | NOT RUN | Actual artifacts, measured query/render behavior and failure cleanup |
| Affected per-file coverage | NOT RUN | Explicit scope, statements/branches, exact 100%, no exclusions |
| Existing dms direct/proxy publication | NOT RUN | Actual operation/media manifest, runtime-role/headers evidence |
| M31 handoff and R6 | OPEN | Completed M30 evidence; separate dashboard/D09 and release gates |

Each future entry must record source checkpoint, exact command and working
directory, environment mode without secrets, node IDs and counts, complete result
including skips/failures, artifacts, coverage scope and remaining limitations.
Historical M29 counts are not new M30 evidence; no implementation pass is claimed.
