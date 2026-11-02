# M29 verification

## Final Runtime After M30 - 2026-10-29

All twelve M29 operations remain published after M30 release. Final runtime has
152/154business+2health at0009; only dashboard/chatbot are unpublished. Final full
offline1083pass includes the normal-app M29 contracts/transports, and all three final
direct/proxy/public M29 deployment nodes pass on the final image. M29 disjoint owning
22file1124/196 scope below remains valid; current aggregator66/0 and responses48/18
are separately exact100% in [M30 release evidence](../reports/VERIFICATION.md).
Live411documents/30agencies/24products/receipt774/payment37/oneevent remain unchanged.
The147business/64aggregator figures below describe the earlier M29-only publication,
not current runtime. Whole R5/R6/external terminal bank settlement remain separate.

## All Twelve Operations Published - 2026-10-29

All twelve M29 correction/cancellation operations are now mounted on the existing
Docker backend. Runtime independently reports **147 business operations + 2 health**;
the only missing canonical operations are five M30 reports, dashboard and chatbot.
Source, image and configured Supabase remain revision **0009**. No migration, seed,
provider action or live business mutation was performed for this publication.

Normal-app source verification now passes **36 cases, 5 deselected, 17.37 seconds**:

```powershell
uv run --frozen --no-sync pytest tests/document_corrections/test_contract.py tests/workflows/test_contract.py -q --tb=short -k 'not published_report_contract' --junitxml=../data/backend/m29-published-source-contract-20261029.xml --cov=app.api.router --cov-branch --cov-report=term-missing --cov-report=json:../data/backend/m29-published-api-coverage-20261029.json
```

The five deselected nodes belong to M30, not M29. M29 inventory assertions permit
only future read products to remain unpublished; all twelve M29 IDs are required.
The final M29/M30 publication test separately requires only dashboard/chatbot absent.
Aggregator coverage is exact64statements/0branches, separate from the disjoint
22-file1124statement/196branch owning scope below; no obsolete line data was combined.

`docker compose build backend` passed with frozen dependencies, including locked
XlsxWriter3.3.0. `docker compose up -d --no-deps --wait --wait-timeout 120 backend`
updated the existing backend service. Frontend was neither rebuilt nor recreated.
Both existing services are healthy. The ngrok agent was explicitly restored at the
existing configured domain/upstream8000, without modifying callback settings.

```powershell
$env:M29_DIRECT_URL='http://localhost:8000'
$env:M29_PROXY_URL='http://localhost:8080'
$env:M29_PUBLIC_URL=(Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels').tunnels[0].public_url
uv run --frozen --no-sync pytest tests/deployment/test_10_m29_publication.py -m 'integration and deployment' -q --tb=short --junitxml=../data/backend/m29-final-deployment-20261029.xml
```

Actual deployment result: **3 passed, 14.11 seconds**. Direct/proxy/public each verify
readiness, canonical/unique manifest, all twelve owner/action routes, unauthenticated
401/request IDs, missing-precondition428 and CORS. Synthetic nonexistent document IDs
only; deployment checks do not modify live business documents.

Existing-container `python -m app.db.verify` passes all30tables and document/ledger/
cache/audit/report integrity:411documents,30agencies,24products. A separate read-only
SQLAlchemy assertion confirms receipt774 POSTED/PAYMENT_RECEIPT/DEBT_COLLECTION,
current revision POSTED/10200VND/ONLINE, payment37 SUCCESS/VNPAY/receipt774/10200VND,
and exactly one payment event. `alembic current` returns0009(head).

Independent review rechecked the goods fix and resolved its only concrete finding;
no additional high-confidence correction defect was found. M29 owning/publication
gates are complete; M30 actual SQL/export verification is running separately. This
does not close whole R5/R6, external terminal bank settlement or frontend gates.

## Normal Aggregator Source Gate - 2026-10-29

Parent mounted the three remaining owning correction routers in `app/api/router.py`.
All twelve M29 operation IDs now use normal application composition, without test-only
router injection. This is a source checkpoint, not a deployed-runtime claim.

From `backend/`:

```powershell
uv run --frozen --no-sync pytest tests/document_corrections/test_contract.py tests/workflows/test_contract.py -q --tb=short -k 'not source_operation_inventory and not published_report_contract' --junitxml=../data/backend/m29-normal-app-contract-20261029.xml
```

Actual result: **35 passed, 6 deselected, 5.61 seconds**, two existing dependency
deprecation warnings. The six deselected nodes depend on final M30 publication and
remain required/unclosed here. All twelve correction source schemas, statuses,
permissions, headers and command/precondition parameters pass the selected gate.
The source inventory has147business+2health; existing deployed runtime remains
141business+2health until explicit parent deployment. No live business ID was mutated.

## Final Gate Reconciliation - 2026-10-29

Current scope is the remaining six issue/return/credit operations plus an independently
reviewed receipt-history defect. The parent owns aggregator/publication/deployment;
this worker has made no runtime change or live business mutation. Opening deployed
state remains141target+2health/schema0009 until the parent's publication evidence.

New commands actually run from `backend/`, prefix `uv run --frozen --no-sync`:

| Selection | Actual result | Artifact under data/backend |
| --- | --- | --- |
| `pytest tests/integration/document_corrections/test_http_negatives.py -m integration -vv --tb=short --maxfail=1` |1passed130.52s, no skips/xfails| `m29-http-negatives-20261029.xml` |
| `pytest tests/integration/document_corrections/test_historical_policy.py::test_removed_receipt_product_reuses_latest_posted_snapshot_after_retirement -m integration -vv --tb=short --maxfail=1` before fix |1failed113.36s, expected regression red| `m29-historical-reintroduction-red-20261029.xml` |
| Goods14-case current-source selection below after fix |14passed1984.30s, no skips/xfails| `m29-goods-review-green-20261029.xml` |
| `pytest tests/document_corrections/test_schemas.py tests/document_corrections/test_owner_transport.py -q --tb=short` |14passed4.07s| `m29-current-offline-20261029.xml` |

The HTTP-negative node tests all twelve owner/action pairs: unauthenticated401,
authenticated wrong-kind404, unsupported-media415 and malformed-JSON400. Full
business/audit/command snapshots are unchanged. Retained realPG eight-case HTTP
lifecycle/allOf/cancel-only/conditional-cash/precondition/key tests are still the
positive and live-grant evidence; this negative node does not replace them.

Independent read-only reviewer identified `goods.replace` using only current revision
lines, unlike SQL0008 and the issue coordinator. RealPG red reproduces loss of the
original product name after removal/reintroduction across a rename. The minimal fix
selects each product's latest same-document POSTED snapshot; the regression also
exercises subsequent product+unit retirement, unchanged prior revisions/lines and
stock reconciliation. No admission guard, SQL snapshot or migration was changed.
Fresh14-case goods lifecycle/guards/races/historical regression passes. Only the
unsupported-kind constructor ValueError is absent from PG execution; the current
offline constructor test covers it. Combining these two same-source data files gives
exact102statements/30branches, zero missing/partial/excluded lines, under
`.coverage-m29-goods-current-20261029` and `m29-goods-current-20261029-coverage.json`.
Old goods line-offset data is not used as current-file coverage proof.

Exact PG green command after fixture inspection, from backend in PowerShell:

```powershell
$env:SUPABASE_TEST_SCHEMAS='1'; $env:COVERAGE_FILE='../data/backend/.coverage-m29-goods-review-green-20261029'; uv run --frozen --no-sync pytest tests/integration/document_corrections/test_goods.py tests/integration/document_corrections/test_goods_guards.py tests/integration/document_corrections/test_goods_races.py tests/integration/document_corrections/test_historical_policy.py::test_historical_receipt_correction_reuses_inactive_snapshots_but_not_new_inactive_goods tests/integration/document_corrections/test_historical_policy.py::test_removed_receipt_product_reuses_latest_posted_snapshot_after_retirement -m integration -vv --tb=short --maxfail=1 --junitxml=../data/backend/m29-goods-review-green-20261029.xml --cov=app.modules.document_corrections.goods --cov-branch --cov-report=term-missing --cov-report=json:../data/backend/m29-goods-review-green-20261029-coverage.json
```

Run through tracked `background_process monitor` with600000ms output budget, then a
blocking `Wait-Process` for that same process until completion. No polling loop, new
server/database/container or partial-result pass claim. Finished XML confirms all14.

Retained artifacts inspected and exact scopes rechecked, not rerun as whole suites:

- `m29-final-services.xml`:28passed2888.182s, zero failed/error/skipped. Its stable
  `.coverage-m29-final-services` independently reports credit49/12, issues163/52 and
  returns109/36, total321statements/100branches exact100% each. This supersedes the
  stale running/97%-coverage note below for these three files only.
- `m29-financial-closure.xml`:16passed1752.59s as detailed below. This overlaps stable
  service nodes and is not added to28as a unique-case count. Its original-period,
  mutation-stage rollback and observed both-winner races retain their evidence.
- `.coverage-m29-release`, excluding now-modified goods.py, retains11unchanged files
  and448statements/66branches exact100%. Explicit include export:
  `m29-retained-unchanged-20261029-coverage.json` (manual service; goods/manual owner
  routers+schemas; settlement service/repository; manifest;0008 migration).
- `.coverage-m29-all-owner-transport`: three remaining entire routers177/0exact100%.
  `.coverage-m29-current-offline-20261029`: three remaining owner schemas63/0exact100%.
- `.coverage-m29-migration9`:0009migration13/0exact100%; behavioral migration evidence
  remains `m29-issue-migration-final.xml` five realPG cases, not inferred from coverage.

These are disjoint production-file scopes. Do not union old goods or old issue
line-offset data into current file proof or inflate case counts with repeated nodes.
The supplementary combined retained file is not a new execution or a whole-backend
coverage gate. No required test is closed using a skip, xfail, interrupted job or
partial coverage. Fixture inspection confirms SUPABASE_TEST_SCHEMAS=1 chooses only
UUID schemas in current Supabase, and TestClient opens no listening HTTP port.

The full affected production gate is the disjoint union of22files,1124statements and
196branches, exact100% per file: current goods102/30, stable financial services321/100,
unchanged retained11files448/66, remaining routers177/0, current remaining schemas63/0,
and migration0009 13/0. Each component was checked with `coverage report` or `coverage
json --fail-under=100` against its explicit include scope; no exclusions were added.
Coverage is not a fresh whole-backend test run or proof of deployment.

`ruff check app/modules/document_corrections tests/document_corrections
tests/integration/document_corrections` passes. `ruff format --check` over those same
paths reports36files formatted. `git diff --check` passes (Git emits LF/CRLF warnings).
Independent review's one concrete M29 finding has real red/green resolution; its
read-only review reported no other high-confidence correction defect. No external
bank/provider result or full R5/R6 release claim is inferred.

PG slot was explicitly released to the parent after all M29 PG completed; no further
M29 PG is planned. Normal-app fixtures and source contract now remove the explicit
test-only router composition, ready for parent-owned aggregator mounting. The final
`tests/document_corrections/test_contract.py` selection must run after mounting all
M29+M30 operations; its exact canonical missing set is dashboard/chatbot. That final
source-contract/deployment gate is not claimed passed here while source is unmounted.
Recommended parent checks: full owning/source contract offline selection, existing
direct8000/proxy8080/public-domain manifest/all-twelve authentication/preconditions,
schema0009/readiness and read-only live integrity/receipt774/payment37/one-event
preservation. Do not exercise correction/cancel on live business IDs.

## Remaining-six retained closure - 2026-10-28

After the six-operation publication, user explicitly requested full M29/M30/M31.
No new commits/publication yet in this phase. Runtime remains141target+2health0009.

Completed scoped evidence (same Supabase UUID-schema harness, serialized PG runs):

- `m29-financial-final.xml`:8passed/1failed before maxfail. All return boundary,
  reserved/paid protection cases passed. Credit test expected PAYMENT_EXCEEDS_DEBT
  before any credit existed; replay correctly returns INSUFFICIENT_CREDIT. Source
  chronological credit consumption was inspected and only the erroneous assertion
  changed, retaining full persisted-state rollback comparisons.
- `m29-financial-closure.xml`: **16passed,1752.59s**, no skips/xfails. Corrected credit
  protection reserved/paid2, return post-mutation rollback1, upfront linked-money
  rollback2, separated historical confirmation1, seven observed opposing-race cases,
  three independent Jan-to-Feb period/cancel oracles. Explicit source rows, all
  signed ledger reversals and caches reconcile; original revisions/lines/lots retained.
- Race cases cover both winners issue-cancel/return-post, return-reduce/credit-post,
  credit-increase/refund-reserve, and correction/count-confirm in both orders. Losing
  commands leave no partial successor/audit/command effects; stale ETag and fresh
  semantic rejection are tested separately. Existing ordered_race uses independent
  sessions and observed PostgreSQL blocking, not mocked concurrency.
- Offline transport9pass3.75s, `m29-all-owner-transport-coverage.json`:
  stock-issue/sales-return/credit-application entire routers177statements exact100%.
  This verifies delegation/ID/precondition/key/status/header propagation only;
  retained realPG HTTP grant/retry evidence is still required and retained.
- Static independent correction lock/source/evidence review found no concrete defect;
  no test/runtime result is inferred from review.

Historical combined coverage before the final date-sync refinement was97% of correction services:
  credit/goods/manual exact100%, issue one partial branch, returns8missing lines.
Return failed/maxfail coverage was not flushed, so its passing nodes are behavioral
evidence but cannot silently be counted in an aggregate. A final stable service
selection subsequently completed:28passed and321/100exact in the inspected
`m29-final-services.xml`/coverage artifact, reconciled above.

Date-sync refinement: only CONSUMED evidence should sync its automatic receipt.
The supported verify/replace/post lifecycle and seed cannot produce VERIFIED on a
POSTED corrected issue, although raw SQL can manufacture schema-admissible history.
`IssueCorrectionService.evidence(states=...)` now defaults VERIFIED/CONSUMED for
cancellation and selects CONSUMED only for date sync, preserving old behavior even
for anomalous SQL history without an unreachable inner state branch. No artificial
VERIFIED fixture, exclusion pragma or weakened money guard was introduced.

Further source/runtime publication, complete affected coverage and remaining required
HTTP negatives stay open until recorded as passed. M30/M31 own six-file plans now
exist but no report/dashboard implementation is implied by this checkpoint.

## Six-operation publication - 2026-10-28 (historical)

Published six complete owning operations: correct/cancel StockReceipt,
StockAdjustment and manual PaymentReceipt. Issue/return/credit correction routers
are separate and unmounted in production; their canonical handlers remain available
only to explicit in-process test composition. Runtime now **141target+2health**.
Source, deployed migration files and configured Supabase are **0009**. Full M29
and M30-M32/R5/R6 remain open; this is not twelve-operation completion.

Additional completed commands/evidence:

- Independent manual-period SQL oracle compares current source documents, all
  signed ledger entries (including reversals) and cached debt before/date-move/
  cancellation:1passed110.86s, `m29-manual-period-oracle-final.xml`. Initial fixture
  SQL quoting failure is preserved separately, not claimed as passing.
- Stable issue lifecycle/boundary/race selection18passed1581.92s,
  `m29-issue-stable.xml`;164statements/54branches99%, one partial evidence-state
  branch. This is retained unpublished issue evidence, not a release gate shortcut.
- Migration0009fresh/populated downgrade/re-upgrade, unchanged seed410documents,
  product/unit/agency historical-vs-first/new admission and54SQLregressions:
  5passed814.61s, `m29-issue-migration-final.xml`. Only generated Supabase schemas.
- Changed settlement repository retained posting/guard selection11passed413.41s,
  `m29-release-repository.xml`; combined with date-move/protection coverage gives
  exact73statements/20branches100%. No unrelated baseline rerun required.
- Three offline owner-transport tests cover all delegations, integer IDs,
  precondition/key propagation and response/status/header preservation;3passed3.62s.
  Actual database HTTP lifecycle/grant/retry tests remain the earlier eight-case
  evidence, not replaced by mocks.
- Final default offline after six-operation isolation:589passed588deselected45.32s,
  `m29-six-release-offline.xml`. An earlier isolation assertion failure in workflow
  contract was updated to explicitly require six present/six absent, not removed.
- Declared release production scope **12files550statements96branches exact100%
  each**, no missing/partial/excluded lines. `.coverage-m29-release` combines retained
  `.coverage-m29-packet`, current release-repository, return-lot-dates,
  release-offline and owner-transport data with `--keep`. Exact include list is in
  `m29-six-release-coverage.json`: goods/manual services, three owner routers/schemas,
  settlement service/repository, manifest and0008migration. This is not whole-code
  or remaining six-operation coverage;0009has its separate real migration evidence.

Deployment actually performed after user-facing notice:

1. `docker compose -p dms build backend` passed locked install; image
   `sha256:11f243fa3e0948ec49d21346e189327184841aab18ee2bdef033071c9be0d4a2`.
2. Copied reviewed0008/0009migration Python/SQL files into the existing backend
   container, then `docker compose -p dms exec -T backend alembic upgrade 0009`;
   `alembic current` confirmed0009(head). No job/new service/database was created.
3. `docker compose -p dms up -d --no-deps --no-build --wait --wait-timeout 120 backend`
   replaced only the existing backend service, now healthy. Frontend image/container
   untouched; Nginx continued resolving backend and proxy readiness passed.
4. Explicit direct8000/proxy8080/existing public-domain deployment selection
   `tests/deployment/test_10_m29_publication.py -m deployment` passed3cases13.44s,
   `m29-six-publication.xml`: exact143manifest, six present/six absent, readiness,
   unauthenticated401with request IDs and CORS preflight. Synthetic nonexistent IDs
   only; no live business lifecycle mutation/provider call.
5. Existing-container `python -m app.db.verify` passed30tables and unchanged
   411documents/30agencies/24products; business row counts match opening. Read-only
   assertions confirm receipt774POSTED/10200/DEBT_COLLECTION/ONLINE, payment37SUCCESS
   and exactly one payment event. Two failed diagnostic invocations (shell quoting,
   wrong build_engine argument) ran no SQL; corrected stdin invocation passes.

No seed/reset, frontend edit/rebuild, ngrok route change, provider mutation or commit.
Remaining work: unpublished issue/return/credit full gates, remaining original-period/
opposing races and release gates; do not rerun all historical evidence by default.

## Resume in progress - 2026-10-28

Docker Desktop was stopped at opening; `docker desktop start` restored only the
existing dms-backend-1/frontend-1, both healthy. Direct/proxy readiness passed and
existing-container `alembic current` remains0007. `python -m app.db.verify` passed
30tables and411documents/30agencies/24products without seed/reset. Runtime OpenAPI
remains137HTTP operations. Ngrok was subsequently explicitly restored to the existing
configured domain/upstream8000; public readiness passed. No new database/container/
server/tunnel domain was introduced. User now explicitly permits env reads/values;
no secret values were printed or env edits needed.

The worktree already contained issue/upfront/return/credit services, twelve owning
handlers and source0009 beyond the previous handoff. These were not deployed or
assumed verified. Source contract tests show147target+2health; this is distinct from
configured/deployed0007/135target+2health. Initial lint issues in new tests and one
formatting issue were repaired. An obsolete provider publication test asserting
135source operations was updated to assert147and all twelve owning correction IDs,
while retaining canonical-ID/provider checks and absent reports. Initial offline
run585pass/1fail is superseded by **586passed,556deselected,50.57s**, artifact
`data/backend/m29-resume-offline-final.xml`.

Actual commands use `uv run --frozen --no-sync pytest` from backend. PG commands
explicitly set `SUPABASE_TEST_SCHEMAS=1`; inspected harness creates/drops only UUID
schemas in the configured Supabase database. TestClient runs in-process, not an
additional app server.

| Selection | Completed result | Artifact under data/backend |
| --- | --- | --- |
| `tests/document_corrections -q --tb=short` |18passed,9.80s| console |
| `tests/integration/document_corrections/test_issues.py test_issue_policy.py -m integration -vv --tb=short --maxfail=1` |7passed,526.15s| `m29-resume-issues.xml` |
| `.../test_return_credit.py .../test_http.py` with same PG flags |8passed,910.28s| `m29-resume-http.xml` |
| `.../test_issues.py` after review fixes |8passed,662.04s| `m29-resume-issue-fixes.xml` |
| `.../test_issue_races.py` final |3passed,219.37s| `m29-resume-issue-races-final.xml` |
| `.../test_issue_races.py::test_cash_grant_revoked_in_another_connection_after_separation_rolls_back` |2passed,166.69s| `m29-resume-cash-grant-races.xml` |
| `.../test_issues.py::test_issue_duplicate_total_fraction_and_effective_returns_reject_atomically` |1passed,144.90s| `m29-resume-issue-boundaries.xml` |
| `.../test_issue_boundaries.py` |3passed,280.55s| `m29-issue-additional-boundaries.xml` |
| Expanded `.../test_http.py` |8passed,2105.53s| `m29-resume-http-auth.xml` |
| Return-lot date regressions3 + retained return/credit2 + reserved/paid2 |7passed,955.08s| `m29-return-lot-dates-green.xml` |
| Retained pure settlement |30passed| `m29-return-lot-dates-pure.xml` |

Issue fixes retain the conditional cash grant across evidence mutation, so the
final authorization cannot lose the separation requirement. VERIFIED and CONSUMED
injected post-replay revocation tests prove complete persisted rollback. Historical
issue lines now resolve the latest matching POSTED snapshot across the same document,
allowing removal/reintroduction after retirement without adopting renamed master data.
The three-revision realPG regression passes. A subsequent two-case real race uses
independent connections to revoke the actual group grant after separation and replay;
both VERIFIED/CONSUMED paths reject at the final check and restore all effects. This
supersedes the earlier injected-only limitation, not the wider opposing-race matrix.

Issue/cash opposing races use independent sessions and observed PostgreSQL blocking.
Correction-first rejects the later overpayment. Receipt-first changes the complete
issue ETag, rejecting the waiting stale correction; a fresh-ETag attempt then proves
PAYMENT_EXCEEDS_DEBT and full rollback. Initial race assertion incorrectly expected
the debt error before ETag validation (1pass/1fail, `m29-resume-issue-races.xml`);
the corrected full selection above supersedes it. Same-key race creates one successor
and one command. No production guard/assertion was relaxed to obtain these results.

Two independent read-only reviews ran: HTTP review found verification gaps; service
review found the cash-grant defect above, stale return-lot FIFO dates and historical
issue admission mismatch. Return-lot repository correction now uses effective current
return dates in lots()/available() while preserving original lot/source/receipt IDs.
All three date-move regressions failed against original code (`m29-return-lot-dates-red.xml`)
and pass with the fix. Their source/availability/filter/tie assertions and retained
reserved/paid cases pass. Scoped repository coverage81% is not whole-file closure.
Migration0009verification and further return/credit boundaries remain in progress.

Expanded eight-case HTTP selection passes each missing correction grant403,
cancel-only with no read/post grants, both actions' missing428/422/stale412headers,
same-key result and changed-payload409with complete-state comparisons. Correction
media415/malformed JSON400/extra-fields422and cancellation blank/extra422are verified.
VERIFIED and CONSUMED upfront cancellations require cash permission on fresh and
completed retry, preserve40VND exactly once and reject a replay after grant revocation.
This run overlapped the reviewed issue source edit, so its coverage is not a stable
whole-file aggregate and is not used to claim exact affected coverage.

Coverage is intentionally not a closure claim: issue-fixes selection is90%, and the
first return/credit/HTTP selection84% of correction services (credit49/12exact100%).
Missing failure/boundary/race/original-period/deployment gates remain open. No current
runtime migration or service artifact update has occurred; M29-M32/R5/R6 remain open.

## Goods + manual cash internal checkpoint — 2026-10-25

Current verified union: **572offline +27unique owningPG +12retainedPG**. No new HTTP
operation published; runtime remains135target+2health at0007. Source0008 is tested
only in generated Supabase schemas and is not deployed. No new DB/container/service/
server/tunnel was created. Original goods evidence below remains valid; the added
manual-cash slice has no inventory/old goods code change.

Manual service `ManualReceiptCorrectionService` replaces or cancels only manual
DEBT_COLLECTION CASH/BANK_TRANSFER. It preserves stable identity and agency snapshot,
reverses superseded financial legs and replays later sources in the same command.
Cancel-only permission remains sufficient: M16's WRITERS now admits the existing
documents.correct/documents.cancel orchestration callers, with outer allOf checks
and post-lock/completed-replay authorization verified. No special cash is editable.

Additional actual commands from backend, prefix `uv run --frozen --no-sync pytest`:

| Selection (all PG use `-m integration`) | Result | Prefix under data/backend |
| --- | --- | --- |
| `tests/integration/document_corrections/test_manual_receipts.py -vv --tb=short --maxfail=1` |3passed,475.66s| `m29-manual` |
| `.../test_manual_races.py` same flags |5passed,410.77s| `m29-manual-races` |
| `.../test_manual_protection.py::test_manual_source_correction_preserves_or_blocks_reserved_and_paid_refund_money -q --tb=short` |2passed,270.68s| `m29-manual-source-protection` |
| `.../test_manual_protection.py::test_posted_online_auto_and_separated_receipts_are_protected_in_full_seed -q --tb=short` |1passed,200.85s| `m29-manual-seed-final` |
| M16 `test_posting.py` plus paid-partial-effects guard and full-seed immutable replay IDs |10passed,752.38s| `m29-settlement-retained` |
| Full default offline `-q --tb=short` |572passed,541deselected,111.93s| `m29-offline-final` |

The11manual owning IDs add to16goods IDs. The10retained M16 IDs add to2earlier retained
goods IDs. Repeated IDs are not added again. Required race cases use independent
sessions and observed PostgreSQL blocking: both correction/post winners, one-key
one-successor, and post-grant revocation during balance wait. Real grant tests prove
each missing correction grant and cancel-only completed replay. Actual M23 returns
and M16 reservations/consumption prove both valid protected-source restatement and
atomic rejection when reserved or paid money would lose its source. No bank provider
call is involved or claimed by these internal fixture payouts.

One protection selection originally ended2passed/1failed: the test incorrectly
assumed seed already contained a POSTED RECEIVED_UNAPPLIED receipt. Seed instead
contains VERIFIED unreceipted money. The repaired fixture calls the actual M19
`UpfrontPaymentService.separate` in the isolated schema before checking all three
protected POSTED receipt categories. The corrected same seed-test ID passes above;
the two source-protection IDs were also rerun for a complete passing coverage artifact.
The failed selection is retained at `m29-manual-protection.xml`, not reported as pass.

Combined `.coverage-m29-packet` uses the earlier `.coverage-m29-final` plus final
offline, manual, manual-races, manual-source-protection, manual-seed-final and retained
M16 files. Exact include scope: goods/manual correction modules, three changed owning
schema files, M16 service, manifest and0008 revision. Report with `--fail-under=100`
passes **310statements/76branches across9files, exact100% per file**. JSON:
`data/backend/m29-packet-coverage.json`. This is affected-slice coverage, not whole-backend
coverage. The initial file-valued migration coverage mistake is superseded by the
directory-scoped migration data noted below.

`ruff check .` passes; `ruff format --check .` reports486formatted files. Two
independent reviewers could not launch because of tool quota; no such review is
claimed. Primary-agent local review checked transaction/lock ordering, complete
preconditions/key replay, preserved snapshots/provenance and the four canonical goods
plus two manual-cash contracts. Source services remain internal: HTTP publication,
remaining issue/upfront/return/credit orchestration and full M29/R5 gates are open.

Next executable slice: zero-upfront posted stock-issue replacement/cancel, then
upfront synchronization/separation. Preserve inactive issue/terminated-agency D15
gate separately;0008 currently changes only receipt master admission.

Final read-only checkpoint: Compose backend/frontend healthy; readiness8000/8080
both200; runtime OpenAPI137HTTP operations; ngrok upstream remains8000. Host
`alembic heads` reports0008; existing-container `alembic current` reports0007(head of
that deployed image). Compose `config --quiet` and `git diff --check` pass. Direct
read-only assertions in the existing backend verify receipt774 POSTED/10200VND/
DEBT_COLLECTION/ONLINE, payment37SUCCESS and exactly one payment event. The first
inline CLI attempt had a quoting SyntaxError before SQL; passing stdin invocation
supersedes it. Final namespace inventory contains only the two preserved Oct22 test
schemas, none from this M29 session. No frontend source edit, commit or push.

## Goods slice checkpoint — 2026-10-25

Internal `GoodsCorrectionService` now supports receipt and independent adjustment
replacement and DRAFT/POSTED cancellation. No new routes are mounted. Source head is
0008; configured runtime remains0007 with137HTTP operations. No live migration/restart.

Actually completed from `backend/` (`uv run --frozen --no-sync` prefix):

| Selection | Result | XML / coverage prefix in root data/backend |
| --- | --- | --- |
| Default `pytest -q --tb=short` with scoped coverage |571passed,530deselected| `m29-offline` |
| `tests/integration/document_corrections/test_goods.py -m integration -vv --tb=short --maxfail=1` |5passed,692.81s| `m29-goods-verified` |
| `.../test_historical_policy.py` same integration flags |3passed,304.88s| `m29-policy` |
| `.../test_goods_guards.py` |3passed,408.29s| `m29-guards` |
| `.../test_goods_races.py` |4passed,375.62s| `m29-races` |
| `.../test_migration_seed.py` |1passed,222.34s| `m29-migration` |
| `.../test_historical_policy.py::test_populated_0007_upgrade_and_downgrade_preserve_history` |1passed,110.13s; repeats existing ID| `m29-migration-downgrade` |
| Retained receipt inactive/rounded-zero guard and adjustment lifecycle nodes |2passed,244.60s| `m29-retained` |

Thus16unique owningPG plus2retainedPG, not17owning. Explicit
`SUPABASE_TEST_SCHEMAS=1` throughout; all completed fixtures clean their UUID schemas.
The populated migration test seeds only its generated schema, twice verifies the
same410historical documents and runs54regressions rolled back in another schema.
No live reset/seed/receipt774 mutation occurred.

Coverage files `.coverage-m29-{offline,goods-verified,policy,guards,races,migration,migration-downgrade}`
were combined with `coverage combine --keep --data-file=../data/backend/.coverage-m29-final`.
`coverage report --show-missing --fail-under=100` with explicit include of goods module,
two changed owner schemas, manifest and0008 passes **159statements/30branches exact
100% per file**, no missing/partial. JSON: `m29-final-coverage.json`. Migration coverage
uses `--cov=alembic/versions`; the earlier policy selection's file-valued `--cov`
emitted module-not-imported and was not used as proof of migration coverage.
Other unchanged migration files' partial coverage is outside this declared scope.

The first full offline collection exposed a missing test-package marker, causing
`test_schemas` import mismatch. Added `tests/document_corrections/__init__.py`; the
completed571-case run above supersedes that failed collection. No cache deletion.

Initial short-budget/background attempts were interrupted with no completed XML;
they are not passing evidence. A foreground sample completed in140.96s. A45-second
faulthandler dump was an I/O sample, not a confirmed driver deadlock. Python-driver
probe could not import libpq; no driver/dependency change was made. Five interrupted
fixture schemas were subsequently identified by exact UUID and creation times in
this session (10:00–10:14UTC), then dropped with metadata. Two unrelated Oct22 schemas
were found and preserved. Do not claim all historical test schemas were removed.

Ruff check passes the new/changed code/tests. Two requested read-only review workers
could not start (`usage limit reached`); no independent review success is claimed.
Local standards/specification review remains the available review path.

Live `docker compose -p dms exec -T backend python -m app.db.verify` passes30tables,
document/ledger/cache/audit/report integrity:411documents/30agencies/24products.
Next: internal manual cash and zero-upfront issue replay; upfront/return/credit/full
race/publication/M30–M32 and R5/R6 remain open.

## Opening checkpoint — 2026-10-25

Actually executed from repository root:

- `git status --short`, `git diff --stat`: pre-existing dirty backend/docs/frontend;
  many published backend files untracked. WIP retained.
- `docker compose -p dms ps`: dms-backend-1 and dms-frontend-1 both healthy.
- HTTP GET `/api/v1/health/ready` at8000 and8080:200 each.
- GET `http://localhost:8000/api/openapi.json`:137HTTP operations (135target+2health).
- GET local ngrok `/api/endpoints`: upstream `http://127.0.0.1:8000`.
- `docker compose -p dms exec -T backend alembic current`:0007(head).

No restart/migration/provider action or live business mutation performed at opening.
Read current M26/M27/M28 evidence; their historical568offline/40PG/6deployment and
1783/408coverage are retained evidence, not runs of this session. Paid refund remains
open. M29 six-file plan prepared before new code. No M29 tests run or APIs published
at this checkpoint.
