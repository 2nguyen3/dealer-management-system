# Execution sequence and release handoff

## E21 complete; E22 AI handoff - 2026-10-29

M31 complete/published153/154business+2health/0009. [Evidence](../dashboard/VERIFICATION.md)
records1084offline,14uniquePG,3dashboard+8retained deployed cases, exact161/24module+
68/0API. D09 unchanged, source/image parity and accepted live receipt/payment/event
retained; existingDocker/ngrokhealthy, frontendunchanged. Next E22/M32 uses user's AI
API; HANDOFF requires validated read-only intent/exact authorized readers, provider
privacy/errors and unresolved D10. No API key/model guessed or provider called.
WholeR5/R6/terminalbankrefund/browser remain separate from owning E21 completion.

## E19-E20 complete; E21 next - 2026-10-29

E19/M29 all twelve owning corrections/cancels and E20/M30 all five reports are
published152/154business+2health at0009. [M29](../document_corrections/VERIFICATION.md)
and [M30](../reports/VERIFICATION.md) contain actual scoped commands/results/artifacts.
Final1083offline,11unique M30PG with normal-appHTTP/resource rerun,11unique deployed
endpoint cases pass. Exact coverage/scopes and automated-not-human PDF inspection
are explicitly recorded. Only the existing backend image was rebuilt; frontend
unchanged; live business data and accepted receipt/payment/event retained, ngrok up
on8000. Next E21/M31 then E22/M32. R5/R6 integrated release, external terminalbankrefund
and browser gates remain open; owning E19/E20 completion is not whole-release acceptance.

## E19 internal progress — 2026-10-25

M29 goods/manual-cash services now pass their internal gates;572offline+27owningPG+
12retainedPG, affected9-file310/76exact100%. Source0008 is isolated-test verified but
not deployed; normal runtime0007/135target+2health. No new HTTP operation published.
Continue §5 item2's zero-upfront issue, then items3–7; whole E19/R5 remains open.
[Exact M29 evidence](../document_corrections/VERIFICATION.md).

## E16–E18 native publication handoff — 2026-10-25

All27M26/M27/M28operations mounted:135target+2health at0007.568offline+40uniquePG+
6deployment and packet1783/408exact100% pass. Native automatic IPN for10200VND
payment37 created receipt774/event; live411documents with original seed retained.
Signed refund15714325 request/query is05/PENDING, not an external paid outcome.
Terminal bank settlement remains open; E19/M29 is next. Exact current commands and
scope are in [M26 evidence](../online_payments/VERIFICATION.md). Frontend browser and
whole-release gates remain separate.

## E15–E18 engineering handoff — 2026-10-24

M25 core is mounted; M26/M27/M28 have complete isolated operation branches and exact
owning coverage:117/4,531/126,514/100,333/78 respectively. Current verified union is
432offline+82selectedPG+4direct/Nginx; affected32production files1832/340exact100%.
See [current program evidence](VERIFICATION.md) for exact node/coverage scope and
commands. Normal runtime108target+2health at0007, healthy direct/proxy readiness200;
live410documents/30agencies/24products and54SQLchecks preserved.

D07 accepted external sandbox remains unavailable. Native credentials/callback/key/
protocol acceptance must pass before normal provider/dependent publication; controlled
fixtures are not acceptance. M29 is next; posted correction/cancellation and R5/R6
remain open. No frontend browser gate closes from backend engineering evidence.

## Active E15–E18 packet — 2026-10-23

M25 core passed14owningPG+13offline,29retained M16/M24PG and2isolated direct/Nginx;
owning117/4and shared schema176/0exact100%. Runtime108target+2health at0007.
M26 typed HTTPX adapter/rawHMAC/durable TX1/checkout recovery/completion engineering
is active, unmounted; accepted external environment unavailable(D07). M27 internal
manual slice design/code is starting while M26 strict verification remains open;
no M27 route is published. M28/M29 and R4–R6 remain open. See owning VERIFICATION.

**Reviewed:** 2026-10-02; **progress:** 2026-10-18. E13/M21–M22, E14/M23 and the
M24-read part of E15 pass their declared gates. Source/configured Supabase0007,
runtime103target+2health.338offline+84realPG+24direct/Nginx pass; affected30-file
exact100%(1162/162). Next code is M25, the remaining core portion of E15.
M17–M20 implementations pass owning80/exact100%, all370retained PG/TLS and22direct/Nginx;
308offline and affected33-file100%(1285/306) pass. E11/E12/R3 engineering gates close;
that prior checkpoint used head0006/82runtime operations. Its next packet was E13/M21.
This is the execution companion to [PLAN](PLAN.md), [MODULES](MODULES.md) and
[OPERATIONS](OPERATIONS.md). E01/E02, M03/M04's part of E03 and E05 are locally verified;
M01–M14 and M15 core retain verification; E07/E08 pass. Head0006 and82 runtime
operations: [availability](AVAILABILITY.md). The canonical module
prerequisites remain in the [General Plan](../../GENERAL_PLAN.md).

## 1. Baseline to carry into implementation

| Area | Source inspected | Consequence for implementation |
| --- | --- | --- |
| Runtime | `backend/app/main.py`, `modules/auth/router.py`, `modules/user_groups/router.py`, `api/router.py` | Two health, seven auth and five group operations are mounted. Preserve the factory and injected settings. |
| Identity | `backend/app/modules/{auth,users,user_groups}/models.py`, `modules/auth/repository.py`, `service.py`, `dependencies.py` | Reuse five mapped tables, current grants and user-before-token invalidation. Administration extends these models. |
| Transactions | `backend/app/db/session.py`, `modules/auth/service.py`, `modules/user_groups/service.py` | Authentication can start the request transaction; business use cases take explicit commit ownership. Repositories never commit/roll back. |
| Schema | `backend/alembic/sql/0001_initial.sql` through `0004_api_commands.sql` | All seven document kinds and durable scoped commands already exist. Guards validate complete effects; they do not implement workflows or external calls. |
| Seed | `backend/app/db/seed.py`, `verify.py`, `db/sql/seed_helpers.sql` | A populated database already contains returns, credit, refunds and corrections. New writers must account for them before publication. |
| HTTP infrastructure | `backend/app/core/exceptions.py`, `common/responses.py`, `common/transport.py`, `core/request_context.py`, `main.py` | Auth/business safe errors/media protection, validated audit context and precondition/retry/export CORS headers are implemented. |
| UI | `ui/src/app/App.tsx`, `src/lib/api.ts`, `package.json`, `vite.config.ts`, `nginx.conf` | Native fetch checks liveness only. Business integration needs exact strings, parent ETags and explicit endpoint readiness. |
| Requirements | BA BM1–BM16, selected Q01–Q15, SQL, target OpenAPI | Selected decisions supersede conflicting historical BA proposals; contract/schema conflicts have named decision gates. |

The existing authentication verification log is the implementation baseline.
Reconfirm its required checks in the implementation environment; this planning
review establishes no new runtime/database passing result.

The later module-layout refactor has its own
[2026-10-04 runtime evidence](../../../../backend/REFACTOR_VERIFICATION.md).

## 2. Executable work sequence

Each row is a delivery packet, which may require several implementation sessions.
Expand the owning child plan before its code; finish one vertical behavior and its
evidence at a time. “Can overlap” describes work dependencies, not instructions to
execute competing migrations concurrently; assign one owner to shared schema changes.

| Packet | Owning slice(s) | Concrete output | Can overlap / exit checkpoint |
| --- | --- | --- | --- |
| E01 | M02 P0–P2 | Shared guarded PG/contract harness, exact types/errors/audit, cursor and ETag probes | First task; preserve auth and prove stale/missing preconditions. |
| E02 | M02 P3–P5 | Reviewed command registry, transaction finalizer, retry recovery, seed/head manifest and HTTP wiring | After E01; real one-winner, changed-payload and lost-response cases. |
| E03 | M03–M05 | Groups → users/session invalidation → permission upsert | After M02; next-request permissions and assignment/delete races. |
| E04 | M06 | Immutable audit browsing and exact redacted entity projections | After M05; independent of catalogues. |
| E05 | M07–M09 | District, agency-type and unit APIs | Three independent tracks after M02; include existing-history references. |
| E06 | M10–M12 | Rules → products/agencies, eligible-delete repair and price-range decision | Follow owning dependencies; products/agencies can overlap after shared migration coordination. |
| E07 | M13 | Document identity/revision/line/snapshot/batch primitives and all-kind detail readers | After M11/M12; draft-only changes remain ledger-neutral. |
| E08 | M14–M15 | Inventory statement → receipt posting, price-source selection | After M13; stock and price reconcile after concurrent/backdated receipts. |
| E09 | M16 | Exact invoice FIFO, receipt posting, credit provenance and reservation primitives | After M15; independent reference allocations and multi-source conservation. |
| E10 | M16 | Chronological replay planner/persister and persisted-kind capability register | Before M16 closes; backdated insertion replays later sources without deleting history. |
| E11 | M17–M19 | Issue DRAFT/READY → manual receipts → upfront verification/post/separation | After M16 in this order; one transaction preserves full received money. |
| E12 | M20 | Financial overview, invoice balances, statements and allocation reads | After M19; all persisted kinds included, totals independent of pagination. |
| E13 | M21–M22 | Independent adjustments → count/recount/confirm | Can proceed after M15 alongside E09–E12; detect same-quantity intervening movement. |
| E14 | M23 | Returns, cumulative rounding and dependent-return replay | After M20; 1-VND fractional return and original-cash provenance cases. |
| E15 | M24–M25 | Credit readers → explicit credit application | After M23; unreserved same-source funds, no new cash, replay integration. |
| E16 | M26 | Sandbox adapter, persisted setup, payment events, webhook/reconcile and recovery | After M24; can overlap M25; select accepted sandbox before completion. |
| E17 | M27 | Manual refund reservation/confirmation → online attempt/reconcile/retry | After M25/M26; UNKNOWN retains money and restart resumes the same attempt. |
| E18 | M28 | Complete goods-line dispatcher, history/search and snapshot printing | After M13/M22/M27; every kind, version and permission path supported. |
| E19 | M29 | Full posted corrections/cancellation and owning-module closure | After M28; dependency replay, blockers and injected rollback at every stage. |
| E20 | M30 | Five reports, each JSON/XLSX/PDF, using shared exact projections | After M29; original-period corrections and full-filter exports reconcile. |
| E21 | M31–M32 | Authorized dashboard → whitelisted chatbot and safe disambiguation | After M30; resolve D09/D10 in the source contract before consumers. |
| E22 | Cross-module release | Final operation manifest, migration/restore/recovery runbook, runtime-role and direct/proxy evidence | Assemble incrementally; release closes only after all required gates pass. |

### First implementation session: M02 P0

1. Re-read the [M02 child plan](../shared_api/PLAN.md), current diff and auth evidence.
2. Run the documented frozen backend checks and establish the guarded disposable
   PostgreSQL environment. Record actual source/deployment migration heads separately.
3. Extract reusable schema-resolution and database-factory helpers with retained
   auth tests. Keep required integration selection fail-fast when setup is missing.
4. Record the source transport matrix: operation ID, body requirement, auth policy,
   If-Match/If-None-Match, idempotency, response formats and required headers.
5. Register actual new symbols and their tests. Proceed to exact types and safe
   errors only after baseline/harness evidence is recorded.

Do not treat E01–E22 as calendar estimates. Measure completed/tested work after M02
and the first real posting slice, then estimate the remaining critical path using
observed throughput and unresolved replay/provider work.

## 3. Early implementation versus a usable release

There are three distinct gates:

1. **Slice gate:** internal behavior and the named Mxx tests pass.
2. **Whole-operation gate:** every target state/kind/media branch passes; the
   inventory's Full column is the earliest owning gate, not a release promise.
3. **Deployment gate:** the operation supports the persisted dependency kinds in
   the intended database and its required consumer operations are published.

The existing demo makes the third gate important. M16 can develop typed replay
incrementally, but M18 cannot publish a supposedly complete backdated receipt API
that fails simply because a later return or credit application has no handler.
See [D17](DECISIONS.md#d17--persisted-future-kinds-and-release-readiness).

**Recommended release bundles:**

Current E07/E08 evidence: [document core](../document_core/VERIFICATION.md),
[inventory](../inventory/VERIFICATION.md), [receipt core](../stock_receipts/VERIFICATION.md).
M16 E09/E10 now pass [internal settlement evidence](../settlement_core/VERIFICATION.md):
617 combined cases, exact100%, financial seeded-kind replay/provenance/reservations.
80 target+2 health operations are published. M17–M20 now pass owning and deployment
gates; R3's retained prerequisite regression also passes. M28/M29
remain necessary for complete live document-workbench handoff.

| Bundle | Release meaning | Frontend handoff |
| --- | --- | --- |
| R0 | Existing health/auth baseline, with operational mail/schema inputs recorded | F01/F02 can build on the real auth contract. |
| R1 | Shared foundations verified; no new business operation yet | F01 transport/error/version conventions can integrate. |
| R2 | Verified administration and master-data APIs | F04–F13 integrate only their published operations. |
| R3/R4 | Goods/cash and advanced-money engineering milestones; intermediate service/HTTP probes in isolated environments | Contract fixtures and individual complete reads are usable; these milestones alone do not close a live document workbench. |
| R5 | Complete operational workflows with lines, cancellation, history and corrections, plus populated-dependency replay evidence | F14–F29 can close their matching live gates once browser evidence passes. |
| R6 | Complete reporting/export/dashboard/chatbot and deployment evidence | F30–F32 integrate; frontend completion remains separately verified. |

Examples of unavailable actions before the later gates:

- M15 receipt create can include lines, but editing an existing draft's lines needs
  the shared line operations, whose full dispatcher gate is M28.
- M17 zero-upfront posting is an internal branch until M19 supplies its money paths.
- Draft-only cancellation does not publish a target operation that also promises
  posted cancellation; that operation closes at M29.
- A mixed-history financial writer stays unpublished until all required replay
  handlers/blockers exist. A valid request must not be rejected merely because a
  later module has not been implemented.

Publish a per-release, per-operation availability record during implementation:
operationId, method/path, implemented branches, first/full gate, migration head,
persisted-kind coverage, exact evidence link and available consumer actions. Derive
HTTP details from OpenAPI; do not create a second hand-maintained API specification.
Runtime OpenAPI must contain precisely the published handlers.

## 4. Migration and decision checkpoints

| Due before | Required decision/work | Evidence needed |
| --- | --- | --- |
| M02 P3/P4 | D01/D03–D05: retry registry, aggregate versions, audit/media/CORS and compatible seed manifest | Fresh/populated head, direct constraints, zero infra rows, repeat seed and retained auth coverage. |
| M10/M11 publication | D16: derived selling-price range | Demonstrate valid SQL inputs that exceed source response Money, then align the single contract and all price projections. |
| M11 or M12 deletion, whichever ships first | D02 shared owner/cache repair | Eligible deletion plus direct-cache rejection and concurrent reference protection. M12 does not acquire an artificial dependency on product HTTP APIs. |
| M16 and each next writer | D06/D08/D17: timeline, provenance and persisted-kind coverage | Explicit replay inputs/outputs, deterministic allocation, real immutable-history and populated-kind tests. |
| M23/M29 | D15: frozen content/current master interactions | Reproduce correction of inactive/terminated historic sources and return-price constraints; resolve semantics before changing guards. |
| M26/M27 | D07: accepted sandbox and durable recovery metadata | Named environment, verified raw-byte envelope or documented adapter boundary, same-key recovery and initiating refund actor. |
| M31 | D09 dashboard admission | Source contract and per-section single-grant tests agree. |
| M32 | D10 candidate continuation | Query-scoped cursor, minimal candidate data, final one-candidate/empty page semantics and permission parity. |

Migration numbers are allocated from the actual Alembic head at implementation.
One owner coordinates SQL, DBML, model registration, seed/verifier manifests and
upgrade evidence; dependent packets reuse that revision. Keep the last known
compatible application artifact and database recovery procedure with each release.

## 5. Where to spend detailed design effort

### Settlement and corrections

E09/E10 should produce a small executable reference model for timeline events and
test it independently of persistence. Then verify the same plans with real SQL
constraints. Inputs identify agency, event checkpoint, original source, amount,
eligible invoices/lots and protected evidence. Outputs explicitly list reversals,
new allocations, preserved cash origins and dependent revisions.

Within E19, implement and verify in increasing dependency order:

1. Stock receipt and independent adjustment corrections/cancellation with stock history.
2. Zero-upfront issue and manual receipt replay across several later receipts.
3. Upfront auto-receipt synchronization and cancellation into separate real cash.
4. Returns, cumulative rounding and affected immutable dependent revisions.
5. Credit applications and multi-receipt cash provenance through repeated returns.
6. Active/consumed refund reservations, paid refunds and confirmed-count blockers.
7. The complete opposing-workflow race matrix and original-period report oracle.

The ordering does not permit publishing incomplete cancellation/correction handlers.
Each layer must roll back revisions, ledgers, audit and command results together.

### Operational ownership

M02 establishes safe request/operation/outcome correlation and reproducible test
commands. Each writer supplies lock/retry diagnostics without raw requests or
credentials. M26/M27 add pending-work age, reconcile outcome and restart recovery;
M30 adds export duration/cleanup and query measurements. E22 consolidates actual
commands into the runbook and an automated check entry point/CI workflow when
implemented. No CI or provider recovery scheduler exists in the current scaffold.

Verify runtime DB grants with the trigger-called functions and tables, not only
with the owner account used by migration fixtures. Keep migration/seed privileges
separate from ordinary API runtime privileges. Use the existing single-worker
deployment unless shared throttling and trusted-proxy behavior are explicitly added.

## 6. Handoff after every packet

Record: completed operation/state branches; actual callable/test mapping; exact
commands/results; old/new migration head; relevant persisted/rollback/race evidence;
unresolved decision IDs; release availability; and the next actionable packet.
Update the owning verification/checklist and both relevant general trackers before
reporting completion. A document count or passing unit suite alone cannot close
financial, deployment or frontend live-integration gates.
