# Agentra project instructions

## Context

Agentra is a Dealer Management System (DMS) software engineering course project for managing
dealer distribution, incoming/outgoing goods, inventory, payments, debt, and
business reports. The implementation includes FastAPI health endpoints, database
configuration, reviewed Alembic migrations for the complete DMS schema, full demo
seed/live SQL verification, and a React starter page. Business APIs and HTTP
authentication are not implemented yet.

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

## Database workflow

- Schema authority: immutable reviewed DDL in `backend/alembic/sql/`; migrations
  `0001` (complete DMS objects/core RBAC) and `0002` (pg_trgm search indexes).
  `openwiki/database-design/*.sql` are psql entry points, not duplicate DDL copies.
- From `backend/`: `uv sync --frozen`, `uv run alembic upgrade head`, then
  `uv run python -m app.db.seed` for the complete demo.
- Verify database work with `uv run python -m app.db.verify --seeded --regression`.
  The 54 regression checks use a separate schema and roll back all fixtures.
- The demo covers all 29 tables, 30 agencies, 24 products, 410 documents and
  June–September 2026 history. Account credentials and exact counts are in README.
- Seed v1 is atomic and repeatable; it verifies existing demo data on rerun.
  It does not reset a populated database, disable triggers or write balance caches.
- Add new revisions for schema changes; do not edit deployed SQL snapshots or
  rerun initial DDL over an existing schema. ORM models are not mapped yet;
  autogeneration only compares explicitly mapped tables. HTTP auth is still future work.

## Runtime context

Supabase PostgreSQL is external. The backend reads separate `DB_HOST`, `DB_PORT`,
`DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `DB_SSLMODE` fields from `backend/.env`.
Passwords are raw values, not URL-encoded connection strings.

Compose publishes the UI at `http://localhost:8080` and the API on localhost port
`8000` by default. Docs are at `/api/docs` on either port. Backend readiness checks
include the database; the frontend waits for readiness at startup. Migrations run
explicitly, never on API startup. See `.agents/workflows/docker.md` for operations.
