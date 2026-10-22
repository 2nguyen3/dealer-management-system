# Agentra project instructions

## Current packet checkpoint — 2026-10-18

M21 stock_adjustments core, M22 stock_counts, M23 sales_returns core and M24
agency_credit pass their owning plans/actual-symbol/scoped/deployment gates.
Actual packet338offline+84PG (29owning+55retained)+24direct/Nginx; affected30-file
production scope1162statements/162branches exact100%. Runtime103target+2health,
source/isolated/configured Supabase0007. Do not replace the
historical705-case baseline with an unrun whole-suite claim. Docker Desktop and
backend/frontend are healthy, direct/proxied readiness200; live integrity preserves
410documents/30agencies/24products. Next code after this packet is M25.
Use the latest [GOAL](openwiki/backend-design/plan/full_backend/GOAL.md) and owning
VERIFICATION files for resumable worker/node/coverage checkpoints. M28/M29 and R4–R6
remain open. Revision0007 preserves original credit lots across same-return rounding
successors; immutable original SQL snapshots and real-money evidence remain protected.

## Context

Agentra is a Dealer Management System (DMS) software engineering course project for managing
dealer distribution, incoming/outgoing goods, inventory, payments, debt, and
business reports. The implementation includes FastAPI health endpoints, database
configuration, reviewed Alembic migrations for the complete DMS schema, full demo
seed/live SQL verification, and a React starter page. Backend authentication and
reusable authorization, shared API foundations, full administration/audit and
master-data APIs through M12, M13 document foundations, M14 inventory and M15 receipt
core, M16 internal settlement and M17–M20 issue/manual-receipt/upfront/receivable APIs
are implemented. M17–M20 owning80-case/exact100% and22direct/Nginx gates pass;
all370retained PG/TLS and308offline cases pass; affected33-file production coverage
is exact100%(1285/306) at that historical checkpoint. M21–M24 now pass their scopes;
M25–M32/frontend auth and
M28/M29 deferred gates are future work.

## Project map

- `backend/`: Python 3.12, FastAPI, Pydantic Settings, SQLAlchemy 2, psycopg 3,
  Alembic, uv, Ruff, and pytest. Read `backend/AGENTS.md` before backend work.
- `ui/`: React 19, strict TypeScript, Vite, plain CSS, npm, ESLint, and Prettier.
  Read `ui/AGENTS.md` before frontend work.
- `compose.yaml`: backend, Nginx frontend, and an explicit migration job.
- `openwiki/BA/`: business analysis documentation.
- `openwiki/database-design/`: complete PostgreSQL/DBML design and psql entry points
  linking to versioned backend DDL and regression SQL.
- `openwiki/backend-design/` and `openwiki/frontend-design/`: design documentation areas.
- `openwiki/backend-design/GENERAL_PLAN.md`: backend module implementation order,
  dependency graph, staged integration and module completion gates.
- `openwiki/backend-design/plan/full_backend/PLAN.md`: full-backend current-state
  assessment, exhaustive operation inventory, 32 work packages, architecture,
  schema/contract gap decisions and integrated verification plan.
- `openwiki/backend-design/plan/full_backend/EXECUTION.md`: 22 delivery packets,
  migration/decision checkpoints, release bundles and frontend handoffs; operation
  publication also requires support for later kinds already persisted by the seed.
- `openwiki/backend-design/plan/shared_api/PLAN.md`: implemented M02 foundations and evidence.
- `openwiki/backend-design/plan/user_groups/PLAN.md`: implemented M03 group APIs and evidence.
- `openwiki/backend-design/plan/{users,districts,agency_types,units}/`: implemented
  M04/M07/M08/M09 owning six-file plans, actual-symbol registers and verification.
- `openwiki/backend-design/plan/full_backend/GOAL.md`: active full-backend goal and next packet.
- `openwiki/frontend-design/GENERAL_PLAN.md`: frontend module order, dependency
  graph, API integration contract and strict UI completion gates.
- `openwiki/frontend-design/plan/full_frontend/`: full frontend operation disposition,
  32 paired child plans, architecture, decisions, tests and execution handoff.
- `openwiki/frontend-design/wr/index.html`: 140 linked static HTML wireframe pages
  for all F01–F32 modules, using synthetic data and no backend calls.
- `openwiki/backend-design/GENERAL_CHECKLIST.md` and
  `openwiki/frontend-design/GENERAL_CHECKLIST.md`: roadmap slice, deferred-integration
  and release tracking; close items only with linked implementation evidence.
- `openwiki/backend-design/API/openapi.json`: target business API contract;
  distinguish future business operations from the implemented health/auth runtime API.
- `openwiki/backend-design/plan/authentication/`: authentication implementation
  plan, requirement traceability, design, per-function tests, checklist and evidence log.
- `.agents/`: shared verification/Docker workflows and project-local skills.
- `opencode.json` and `.opencode/commands/`: OpenCode project configuration.
- `CLAUDE.md` and `.claude/`: Claude Code entry points and project configuration.

Nested instructions add component-specific guidance. Use the relevant README for
setup details and source/configuration as the authority for current behavior.

## Working conventions

- Inspect existing patterns and user changes before editing; keep changes focused
  on the requested task. Distinguish implemented behavior from future plans.
- Backend routes delegate business logic to services. Use request-scoped synchronous
  SQLAlchemy sessions, explicit commits, and reviewed Alembic migrations.
- Backend features live in `backend/app/modules/<feature>/` with owned routers,
  schemas, models, services, repositories and dependencies. `app/api/router.py`
  aggregates routers; shared transport helpers live in `app/common/`, infrastructure
  in `app/core/` and `app/db/`. Repositories never commit or roll back.
- Group new UI features under `src/features/<feature>/`; keep shared infrastructure
  in `src/lib/` and application composition in `src/app/`.
- Update documentation when changing settings, commands, endpoints, or structure.
- Never commit `.env` files or credentials. `DB_PASSWORD` remains blank in the
  example template. Avoid printing resolved Compose configuration with secrets.
  Synthetic demo app passwords are intentionally documented in the root README;
  they are not Supabase/PostgreSQL or provider credentials.
- Keep provider credentials and personal model choices in user-level tool settings.
- Commit and push only when requested. Review status, diff, and recent history;
  stage intended files and use conventional messages matching this repository.
  Do not force-push or rewrite history without an explicit request.

## Verification

Run checks from the owning directory, using the tool's working-directory option
where available. Consult `.agents/workflows/verify.md` for the command list.
Report commands actually run, their results, and any unverified behavior.

Backend uses `uv.lock`; frontend uses `package-lock.json`. Preserve locked installs
and update the corresponding lockfile when changing dependencies.

## Frontend implementation roadmap

Before planning or implementing frontend modules, read
`openwiki/frontend-design/GENERAL_PLAN.md`. Start with frontend/API/test foundations,
then authentication and the permission-aware shell, then business features in
dependency order. Reuse the target backend OpenAPI contract; do not duplicate it.
Track slice/integration status in `openwiki/frontend-design/GENERAL_CHECKLIST.md`;
mocked UI is not live completion. Keep general and child checklists/evidence aligned.

Detailed child plans are prepared under `openwiki/frontend-design/plan/<module_name>/`,
paired with HTML in `openwiki/frontend-design/wr/<module_name>/`. These are design
artifacts; the React business UI remains unimplemented. Every completed frontend function/component/
hook/adapter must have strict success/failure/boundary tests and recorded evidence.
Distinguish contract-mocked slices from real backend/browser integration; do not
close a module with missing API, deferred operations or required unrun tests.

## Backend implementation roadmap

Before planning or implementing any backend module, read
`openwiki/backend-design/GENERAL_PLAN.md` for the recommended order and prerequisite
slices. Authentication is first; shared API conventions and administration follow,
then master data, document/settlement workflows, corrections, and read products.
Infrastructure/database, M01–M14, M15 core and M16 internal settlement retain passing
local evidence. M17–M20 are implemented with80owning cases, exact100%(808/98) and
22direct/Nginx; all370retained PG/TLS and308offline pass at that historical checkpoint.
M21–M24 now pass their declared gates; next code is M25
credit_applications after its owning plan is expanded. M25–M32 and
deferred M28/M29 operations remain future work. Runtime has103target+2health;
configured Supabase explicitly upgraded0007 and live integrity/demo reads pass.
Prior705non-deployment cases are a verified union across checkpointed/resumed runs;
affected M16–M20/shared production coverage is33files/1285statements/306branches100%.
Prior617-case combined M01–M16 coverage is historical, not this new whole-code scope.
R2/R3 engineering gates pass; full goal/R4–R6 active.
The full-backend execution package and active GOAL track the full destination. Use the
full-backend operation inventory's first/full gates and gap register; expand later
work packages into owning child plans before code. M16 must support chronological
replay for backdated postings; M29 completes cross-document correction orchestration.
Track verified slices and deferred/full-module gates in
`openwiki/backend-design/GENERAL_CHECKLIST.md`. Core delivery is not whole-module completion.

Prepare each module's detailed plan under `openwiki/backend-design/plan/<module_name>/`
before code. Register actual functions with strict success/failure/boundary tests;
database mutations require persisted-state/rollback evidence and relevant real
PostgreSQL concurrency tests. Never close a module while its deferred operations
or dependency gates remain incomplete. Record exact verification results and keep
the roadmap's progress, dependency table/graph and owning plan aligned.

## Authentication implementation plan

Before implementing authentication, read
`openwiki/backend-design/plan/authentication/PLAN.md` and its linked REQUIREMENTS,
DESIGN, TESTS, CHECKLIST and VERIFICATION materials. The plan covers the seven
Authentication operations in the target API contract and reusable authorization
dependencies. Implementation evidence is in VERIFICATION; preserve its strict gates
when extending the implemented HTTP authentication module.

For this module, every completed function must have passing success, failure and
boundary tests mapped to its actual symbol. Add new helpers/methods/validators to
the function test register as they are introduced. Database mutations require
persisted-state and rollback tests on isolated PostgreSQL; rotation/reset/lock
claims require real multi-connection concurrency tests. Do not close a checklist
item using skipped, xfailed or unrun required tests. Record exact commands/results
in the plan's VERIFICATION.md and require the scoped coverage gate in TESTS.md.

Keep module plans under `openwiki/backend-design/plan/<module_name>/`, with PLAN.md
and related requirement, design, checklist, test and verification materials. Keep
plans and agent guidance aligned with actual implementation progress.

## Database workflow

- Schema authority: immutable reviewed DDL in `backend/alembic/sql/`; migrations
  `0001` (complete DMS/core RBAC), `0002` (search indexes), `0003` (auth sessions),
  `0004` (durable scoped API commands), `0005` (recorded-unit policy/first-use locks),
  `0006` (eligible owner deletion/product first-use/agency history-date guards), and
  `0007` (same-return successor credit-lot provenance).
  `openwiki/database-design/*.sql` are psql entry points, not duplicate DDL copies.
- From `backend/`: `uv sync --frozen`, `uv run alembic upgrade head`, then
  `uv run python -m app.db.seed` for the complete demo.
- Verify database work with `uv run python -m app.db.verify --seeded --regression`.
  The 54 regression checks use a separate schema and roll back all fixtures.
- The demo covers all 29 domain tables, 30 agencies, 24 products, 410 documents and
  June–September 2026 history. Account credentials and exact counts are in README.
  The command infrastructure table may legitimately have zero rows; source head is 0007.
- Seed v1 is atomic and repeatable; it verifies existing demo data on rerun.
  It does not reset a populated database, disable triggers or write balance caches.
- Add new revisions for schema changes; do not edit deployed SQL snapshots or
  rerun initial DDL over an existing schema. Five identity/access, three catalogue and
  one command-infrastructure ORM tables are mapped;
  autogeneration only compares explicitly mapped tables.

## Runtime context

Supabase PostgreSQL is external. The backend reads separate `DB_HOST`, `DB_PORT`,
`DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `DB_SSLMODE` fields from `backend/.env`.
Passwords are raw values, not URL-encoded connection strings.

Compose publishes the UI at `http://localhost:8080` and the API on localhost port
`8000` by default. Docs are at `/api/docs` on either port. Backend readiness checks
include the database; the frontend waits for readiness at startup. Migrations run
explicitly, never on API startup. See `.agents/workflows/docker.md` for operations.
