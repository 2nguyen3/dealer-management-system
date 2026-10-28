# M25 verification

## Current core availability

Five core operations are implemented and mounted; internal draft cancellation is
verified but its complete public posted counterpart remains M29-owned. All14owning
PostgreSQL and13owning offline cases pass, with exact per-file117statements/4branches.
The latest complete full offline checkpoint has432passed; it is separate from the
retained29M16/M24 PostgreSQL cases and the2isolated direct/Nginx M25 cases. The updated
shared document schema is covered separately as179statements/0branches in this packet.
Configured Supabase remains0007 with410documents/30agencies/24products and54SQL checks
preserved. Normal runtime remains108target operations plus2health endpoints.

## Review/reimplementation checkpoint (2026-10-23)

Concurrent edits were detected during the initial test run. User confirmed the other
process was terminated and requested M25 review/reimplementation. Inspected remaining
files and restored controlled test-only router mounting; no M25 production route is
published yet. Existing shared CreditApplication schema was tightened to canonical
non-null agency/receiptType=null/DRAFT|POSTED|CANCELLED status. No SQL revision added.

Actually passed in this session:

- `uv run --frozen --no-sync pytest -m 'not integration and not deployment' -q --tb=short`:
  **351 passed,460 deselected**,18.69s (includes13 M25 offline contract/schema cases).
- `uv run --frozen --no-sync ruff check .`: pass.
- `uv run --frozen --no-sync ruff format --check .`:384files formatted, pass.
- Controlled Supabase workers explicitly set SUPABASE_TEST_SCHEMAS=1. Checkpoints in
  `C:\Users\23521\AppData\Local\Temp\opencode\<name>.json` record setup/call/teardown:
  `agentra-m25-reimplemented`:2/2HTTP posting/rollback passed;
  `agentra-m25-races`:3/3real opposing/competing money races passed;
  `agentra-m25-service-review2`:1/1internal update/cancel/injected rollback passed;
  `agentra-m25-http-auth`:2/2HTTP boundaries and observed real grant-revocation wait passed.
- Fresh-connection rollback review fix passed in `agentra-m25-review-fixes`; its next
  provenance node initially failed because test helper actor context was reset after
  commit. Reinstalled builder context; multi-lot/multi-invoice return provenance then
  passed setup/call/teardown in `agentra-m25-chronology2`. Remaining chronology rerun,
  final coverage, retained regressions and deployment are pending.

Both standards/specification reviews ran separately. Standards found insufficient
fresh-connection verification immediately after injected rollback; added independent
document/batch/OFFSET checks and verified them. Spec found no confirmed implementation
defect, but required multi-lot/multi-invoice/later-return and historical eligibility
evidence; these tests are being completed. Full-module gates remain open.

No whole-backend PostgreSQL or exact100% claim is made. A timed-out foreground run
was superseded by bounded resumable workers; do not count its unfinished second node.
Slow-worker stack/PG activity inspection found no blocking PIDs in sampled activity.

Subsequent checkpoints: `agentra-m25-service-final` passed the strengthened
fresh-connection rollback assertions; `agentra-m25-historical-final` passed future
credit rejection (with eligible debt already present) and valid backdated insertion
before a later application. Both have passing setup/call/teardown and exit0.
`agentra-m25-chronology2` passed multi-source/invoice return provenance. Current owning
union:10realPG nodes (2posting+1service+3races+2HTTP/auth+2chronology), no required skips.
Coverage combination inspected each file: owning117statements/4branches, changed
document_core/schemas176statements/0branches, zero missing/excluded/partial entries.
Retained M16/M24 worker and deployment probe still running; this is not module closure.

`uv sync --frozen`: audited56packages. `git diff --check` and quiet Compose validation
passed. New frontend changes appeared during backend work and are preserved; they are
outside this module's review/verification scope.

`agentra-m25-boundaries`:2/2passed, including exact one-over-credit rollback and
definite pre-COMMIT failure followed by same-key retry; fresh connections prove no
partial command, document or ledger effects. Owning union now12PG nodes.
`uv run --frozen --no-sync python -m app.db.verify --seeded --regression` passed:
30tables/timestamps/document/ledger/cache/audit/report integrity and54baseline checks.
Live410documents/30agencies/24products preserved; auth-token count24 is legitimate
subsequent runtime activity, not reset to historical16.

Isolated Docker probe `agentra-m25-deployment-results`:2/2passed, direct18000 and
Nginx18080, full sale/cash/return/new-sale/application flow. Seeded only its generated
Supabase UUID schema; normal live dms untouched. Probe uses built locked runtime
dependencies with source/test-only router mount; production remains103target+2health.
Its first launch failed readiness due to old-image import precedence, then explicit
source mount fixed the harness; failed launch is not counted as passing evidence.
`docker compose build backend` passed with frozen runtime install. No provider/font
dependencies were introduced. Normal readiness8000/8080 remains200.

Retained M16/M24 worker completed **29/29PG** with all phases passed (25settlement+
4credit). Full-seed replay included all30agencies/410documents and immutable financial
evidence. The redundant tail worker also exited0; overlapping nodes count once.
Reserved/paid-source actual M25 cases both passed in `agentra-m25-protected`, bringing
owningPG to14. Five core routes now mounted; built/recreated backend is healthy and
actual direct/proxy OpenAPI110operations =108target+2health. Mounted contract13cases
pass; full offline rerun351passed/466deselected17.55s. Public correction/cancel stays M29.

## 2026-10-22 initial inspection

Working tree clean on scaffold-project at9578784. `uv run --frozen --no-sync alembic
current`: configured Supabase0007(head). Read-only live count:410documents/30agencies/
24products. `docker compose ps`: backend/frontend healthy. Direct8000 and proxied8080
readiness both200. No live business data was modified by these checks.

M25 implementation/tests/coverage/deployment gates are pending. Historical M21–M24
results remain prior evidence, not new session results.

D07 checked early: no provider/payment/webhook/callback configuration keys are present
in staging `.env`; values were not printed. User confirmed **Environment not ready**.
Accepted external sandbox identity, credentials, reachable callback and native protocol
mapping are missing. Continue controlled real-HTTP fixtures for M26/M27; their accepted
external-provider deployment/full-module/publication gates remain open.
