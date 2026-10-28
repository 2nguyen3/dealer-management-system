# M26 verification

## Native VNPAY/publication checkpoint — 2026-10-25

All6M26,12M27 and9M28canonical operations are mounted:135target+2health. Native GET
IPN/Return are separate provider transports outside business Swagger accounting.
Native credentials are read from the main `.env`; no credential is copied here.
Source/configured schema remains0007, with no new migration/dependency upgrade.

### Current commands, scope and artifacts

From backend with `COVERAGE_FILE=../data/backend/.coverage-vnpay-offline-all`:

`uv run --frozen --no-sync pytest -q --tb=short --cov=app.modules.online_payments --cov=app.modules.refunds --cov=app.modules.document_history --cov=app.api --cov=app.core.config --cov-branch --cov-report=json:../data/backend/vnpay-offline-all-coverage.json --junitxml=../data/backend/vnpay-offline-final.xml`

Result:568passed/514deselected; six existing dependency deprecation warnings. Native
cases cover exact SHA512 URL/pipe signing, stable dates, money bounds, all mapped
states/expiry11, zero-ID late success, invalid type/currency, malformed/raw/duplicate
proof, query/refund identity and terminal09observation time.

PG opt-in is `SUPABASE_TEST_SCHEMAS=1`; all fixtures use generated Supabase UUID
schemas. Worker executable: `.venv/Scripts/python.exe -u -m pytest`. Common arguments:
`-m integration -vv --tb=short --cov-branch --cov-report=term-missing`, plus:

| Selection | Additional coverage arguments | Result / artifact prefix under root data/backend |
| --- | --- | --- |
| `tests/integration/online_payments` | `--cov=app.modules.online_payments --cov=app.modules.refunds --cov=app.api` |18passed; `vnpay-m26-pg` |
| `tests/integration/refunds` | `--cov=app.modules.refunds --cov=app.modules.online_payments` |11passed; `vnpay-m27-pg` |
| `tests/integration/document_history` | `--cov=app.modules.document_history` |11passed; `vnpay-m28-pg` |

Each worker used `COVERAGE_FILE=../data/backend/.coverage-<prefix>`,
`--cov-report=json:../data/backend/<prefix>-coverage.json` and
`--junitxml=../data/backend/<prefix>.xml`; stdout/stderr are retained as `.log`/`.err`.
Final native assertions were rerun with `uv run --frozen --no-sync pytest
tests/integration/online_payments/test_vnpay.py -m integration -q --tb=short
--cov=app.modules.online_payments --cov=app.modules.refunds --cov-branch
--cov-report=json:../data/backend/vnpay-native-pg-final-coverage.json
--junitxml=../data/backend/vnpay-native-pg-final.xml`, using
`COVERAGE_FILE=../data/backend/.coverage-vnpay-native-pg-final`.
Completed JUnit confirms2passed/0errors/0failures/0skips, superseding the same2IDs in
the18-node selection. Thus40unique current PG nodes, not42. Launcher timeout/abort
messages do not substitute for this independently checked completed JUnit/log evidence.
Native cases prove amount-rejection rollback, full money, readonly Return, late and
duplicate success, provider-I/O NOWAIT lock release, UNKNOWN reservations and signed
FAILED release. Other40-node cases retain real concurrency/rollback evidence.

`coverage combine --keep --data-file=../data/backend/.coverage-vnpay-final` combined
the latest offline data and four named PG coverage files. `coverage report
--show-missing --fail-under=100` passes exact per-file1783statements/408branches,
zero missing/partial. Owning M26=754/190,M27=517/100,M28=333/78,config121/40,API58/0.
JSON: `data/backend/vnpay-final-coverage.json`. This is packet/config/API coverage,
not a new whole-backend100% claim. Ruff check passes; format reports468formatted files.

Two local review passes checked standards (ownership, explicit transactions, bounded
transport/no locks, frozen dependencies, redaction) and specification (canonical
contracts, cash authority, type/currency/expiry and source-money recovery). No
independent-subagent review is claimed. Invalid native refund-type or foreign-currency
payment proof is rejected before completion; the new boundaries have passing tests.

### External evidence and deployment

- A nonexistent-reference read-only probe returned signed91, confirming credentials.
- Initial isolated browser payment10200VND/querydr succeeded; actual signed Return
  proof replayed to IPN returned02after completion. That initial replay alone was not
  automatic IPN acceptance. Its generated schema was subsequently dropped.
- User registered merchant IPN and approved a normal dev-server sandbox transaction.
  Authenticated payment37/agency82 for10200VND succeeded at VNPAY transaction15714357.
  With no querydr/manual IPN for this new transaction, automatic provider IPN created
  one receipt774 and one event. Debt49470→39270. Replay returns HTTP200/RspCode02;
  no second receipt/event. Return remains readonly.
- External isolated refund15714325/5000VND request and later signed query matched
  identity/amount/OrderInfo and returned TransactionStatus05/PENDING. Initial rapid
  queries returned unsigned94duplicate responses and never authorized money updates.
  External bank terminal settlement is still open; no external paid-refund assertion.

The earlier temporary ngrok routing was restored. Its redirecting helper was removed;
isolated acceptance now requires an already provisioned distinct public test endpoint
and never modifies ngrok. Final dev acceptance uses unchanged8000/8080/public domain.
Its normal immutable receipt is retained:411documents/30agencies/24products,21online
payments/20events. Original410seeded documents remain; ordinary live integrity passes.
Do not reset this database to make the historical seeded-count assertion pass.

Backend/frontend images pass builds/health and `nginx -t`. Nginx preserves upstream
API Referrer-Policy, fixing the duplicate fallback previously observed on Return.
`pytest tests/deployment/test_08_vnpay_smoke.py -m deployment -q --tb=short` passes3
explicit direct/proxy/public cases (`vnpay-native-deployment.xml`). The3parameter IDs
of `test_09_packet_reads.py::test_published_payment_refund_history_and_vietnamese_pdf`
were then run separately in parallel with `VNPAY_SMOKE_PAYMENT_ID=37`; each passes.
Artifacts: `vnpay-published-{direct,proxy,public}.xml`. A prior combined runner reached
its150second budget, so it is not used as completed evidence. These6unique deployment
cases verify native rejection/Return,137OpenAPI operations, authenticated SUCCESS,
single-event/refund readers, all7kinds and actual Linux Vietnamese HTML/PDF.

M29 posted correction/cancel, M30–M32 and R5/R6 remain open. M27 terminal external bank
settlement remains an explicit release item; backend publication closes no frontend
browser gate. No commit/push or deletion of user data was requested/performed.

## Historical main-env consolidation — 2026-10-25

At the user's request, VNPAY settings now live directly in `backend/.env`; removed
the separate VNPAY dotenv file and its Settings/Compose loading. Updated `.env.example`,
README/AGENTS, owning requirements/design/tests and roadmap handoff. Existing main
database/auth/mail values preserved. Sandbox URLs and current ngrok IPN/Return values
are transferred; merchant credentials remain blank. Compose requirement returns to
2.20.2+ because no optional env-file mapping is used.

Actually rerun from `backend/` with `COVERAGE_FILE=../data/backend/.coverage-vnpay-main`:

`uv run --frozen --no-sync pytest -q --tb=short --cov=app.core.config --cov-branch --cov-report=term-missing --cov-report=json:../data/backend/vnpay-main-config-coverage.json --cov-fail-under=100`

Result:482passed/506deselected, six existing deprecation warnings. Changed config
remains121statements/40branches, exact100% and zero missing/partial. The revised
`test_main_dotenv_and_environment_priority` proves main-file loading, process env
override and `_env_file=None`; all50native settings cases remain passing in this run.
Ruff check passes; format check reports458files already formatted.

Root `docker compose --profile tools config --quiet`, backend build and
`docker compose up -d --force-recreate --wait --wait-timeout 120 backend frontend`
pass. Both containers healthy; direct/proxy/public-ngrok readiness200. Safe container
inspection reports Settings uses only `.env`, callback fields present and both
credential fields absent. Removed local file confirmed nonexistent. No native routes,
provider calls or new database acceptance claims. Initial evidence below is historical.

## Historical initial VNPAY configuration preparation — 2026-10-25

User selected VNPAY sandbox and reports merchant registration complete. Prepared
`Settings.validate_vnpay_url/validate_vnpay_credentials`, official sandbox endpoint
defaults, SecretStr HashSecret, merchant-code validation and distinct HTTPS callbacks.
Optional ignored `backend/.env.vnpay` loads after `.env` locally and in Compose
(minimum2.24.0). Local file contains the currently working ngrok domain and blank
TmnCode/HashSecret fields. Safe built-image inspection confirms both credentials are
absent; no external credential verification or provider call was performed.

Actually run from `backend/`:

- `uv run --frozen --no-sync pytest tests/online_payments/test_vnpay_settings.py -q --tb=short`
  —50passed. Actual symbols above cover blank/complete/partial settings, merchant
  length/alphabet, malformed/credential-bearing/insecure URL boundaries, secret-free
  errors/repr/JSON and dotenv/process precedence.
- `uv run --frozen --no-sync pytest -q --tb=short --cov=app.core.config --cov-branch --cov-report=term-missing --cov-report=json:data-config-coverage.json --cov-fail-under=100`
  —482passed/506deselected, six pre-existing dependency deprecation warnings. Changed
  `app/core/config.py` scope:121statements/40branches, zero missing/partial, exact100%.
  Generated JSON moved to ignored `data/backend/vnpay-config-coverage.json` at repo root.
  This is configuration-file coverage, not a rerun of the historical32-file packet.
- `uv run --frozen --no-sync ruff check .` —pass.
- `uv run --frozen --no-sync ruff format --check .` —458files already formatted.

From repository root: `docker compose --profile tools config --quiet` passes; a
separate stdin Compose probe accepts a missing optional env file. `git check-ignore
backend/.env.vnpay` confirms ignored; scoped `git diff --check` passes.
`docker compose build backend` and `docker compose up -d --force-recreate --wait --wait-timeout 120 backend frontend`
pass; both containers healthy. Direct8000, proxy8080 and public ngrok database readiness
all200/`{"status":"ok"}`. Runtime remains110operations=108target+2health; zero native
VNPAY paths mounted. No schema/data mutation or new PostgreSQL integration run in this
configuration-only slice. Native checkout/GET IPN/Return/querydr/refund mappings,
accepted sandbox evidence and M26/M27/M28 publication remain open.

## Final engineering checkpoint — 2026-10-24

All six canonical operations and their branches are implemented and verified in the
isolated composition. **Normal publication/full-module acceptance remains D07-blocked**;
the accepted external sandbox environment is not ready. This is not a named external
provider deployment claim.

The final-current agentra-delivery-m26 worker passed all16owningPG nodes with complete
setup/call/teardown. New owning offline selection has37cases; the full backend offline
selection completed432cases. Current collection independently matches passing IDs.
Coverage JSON asserts all7owned files individually exact100%:531statements/126branches,
zero missing/excluded lines and zero missing/partial branches. Changed/new shared
files are measured separately in full_backend/VERIFICATION.md.

Real socket tests cover lost checkout reply, a new service session, same-reference
recovery, final receipt recording and an independent NOWAIT agency-lock probe during
transport. Both webhook/reconcile lock winners preserve one receipt. Unknown domain
commit and final-result commit replies recover by the same event/command identity.
Legacy demo events are readable without rewriting evidence; generic404 is never
definitive absence proof. Callback/page snapshot and callback-during-setup races pass.

Exact final worker commands, coverage input inventory and node-verification commands
are in [program evidence](../full_backend/VERIFICATION.md). Source/configured head0007,
retained migration/seed/integrity and controlled direct/Nginx probes pass. Fresh locked
image includes runtime HTTPX; actual external callback reachability, credentials and
native protocol translation remain unavailable and keep publication gates open.

Planning prepared; no M26 production implementation or passing module test claimed.
D07 user confirmed Environment not ready. Staging has Supabase access but no payment
provider configuration. Missing: accepted external sandbox identity, credentials,
reachable callback URL and native-to-canonical mapping. Controlled realHTTP fixtures
can verify engineering transport/recovery; external acceptance/full-module/publication
gates remain open. DEMO_SANDBOX seeded evidence is not deployed-provider acceptance.

## Engineering progress — 2026-10-23

M26 code is **unmounted/incomplete**. Typed canonical HTTP adapter, strict evidence
models, rawHMAC verifier, PENDING TX1/setup recovery and shared completion service are
being implemented. HTTPX promoted dev→runtime, uv.lock updated; frozen sync passes.
Existing accepted-command state retains paymentId until setup completion; immutable
completed result stores checkout with domain ID, avoiding speculative DDL.

Actually run: `uv run --frozen --no-sync pytest tests/online_payments -q --tb=short`:
26passed (5authenticated canonical contracts, signature boundaries/safe transport,
controlled realHTTP checkout/query and raw-before-parse test). `ruff check .` passes.
Supabase checkpoint `agentra-m26-recovery.json`:1PG node setup/call/teardown passed,
proving committedPENDING before callback, lost-reply202, same-key/new-session checkout
recovery, one fullONLINE receipt and duplicate completion. Adapter in this PG test is
controlledMock, distinct from realHTTP transport case and accepted external provider.
Late-success/intervening-manual-cash tests running; no100%/full-module assertion.

Remaining engineering gaps include full webhook schema/security metadata, independent
webhook/reconcile races, additional failure/restart/event/pagination gates, exact per-file
coverage and standards/specification/deployment review. M27/M28 remain subsequent work.

Further verified checkpoints: `agentra-m26-reviewed`4/4PG (FAILED/EXPIREDlate success,
completion race, durable setup recovery); `agentra-m26-http`1/1PG actual auth/signed
webhook/events/scoped pages; `agentra-m26-setup-race`1/1PG persisted winning checkout+
provider expiry; `agentra-m26-failures2`1/1PG partial rollback, unknown commit/sameevent
recovery and cross-payment provider transaction conflict. No required skip/xfail in
these selected nodes. New boundaries node has passed call; teardown still checkpointing.

Focused spec review found/fixed: different-event conflicting success timestamp,
untranslated/ambiguous database outcome, losing concurrent setup returning unstoredURL,
discarded provider expiry; follow-up fixed discovery/fallback DB handling and permanent
unique transaction conflict409. Regressions above exercise setup and completion fixes.
Most recent owning offline command29passed; full offline before those two additions
378passed/473deselected24.44s. Collection basename conflicts were fixed by explicit
test package __init__.py files; no existing test cache was deleted.
Coverage remains incomplete; adapter file had exact100% in measured offline scope,
but module/service/router/shared-config full exact gate is not met. Do not publish.

## 2026-10-24 final review/compatibility checks in progress

Normal Docker backend/frontend inspected healthy; direct8000/proxy8080 liveness and
readiness200, runtime110operations=108target+2health. Startup proxy failures in recent
logs resolved once backend readiness completed. Source still0007; no SQL snapshot edits.

Additional concrete fixes: invalid provider checkout expiry after committedTX1 now
returns202/current resource on creation, while reconcile may report502; reconcile's
setup-command identity is separate from its terminal-result command identity when a
callback wins during checkout recovery. Default real transport has a total deadline,
tested against a slow body that sends regular chunks. TX1 definite deadlock/serialization
retries are bounded to3 with unchanged command key/fingerprint, before any provider call.

Read-only staging reproduction found a legacy event reader failure: demo JSON only
has simulation flags. Corrected the projection without touching business rows, then
the same read-only staging check reported projection_valid=true. New isolated seeded
reader and real callback/page-snapshot race tests both passed complete phases in
agentra-m26-seed-reader. No provider proof is fabricated from those demo markers.
The all16-node final-current PostgreSQL run is checkpointing as
agentra-final-m26-complete; its unfinished nodes are not yet counted as passed.
