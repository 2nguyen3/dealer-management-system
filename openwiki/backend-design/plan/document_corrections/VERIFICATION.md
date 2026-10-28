# M29 verification

## Six-operation publication - 2026-10-28 (current)

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
