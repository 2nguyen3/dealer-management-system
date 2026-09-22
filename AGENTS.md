# Agentra project instructions

## Context

Agentra is a Dealer Management System (DMS) software engineering course project for managing
dealer distribution, incoming/outgoing goods, inventory, payments, debt, and
business reports. The current implementation is an infrastructure scaffold:
FastAPI health endpoints, database configuration, migration tooling, and a React
starter page. Business workflows and authentication are not implemented yet.

## Project map

- `backend/`: Python 3.12, FastAPI, Pydantic Settings, SQLAlchemy 2, psycopg 3,
  Alembic, uv, Ruff, and pytest. Read `backend/AGENTS.md` before backend work.
- `ui/`: React 19, strict TypeScript, Vite, plain CSS, npm, ESLint, and Prettier.
  Read `ui/AGENTS.md` before frontend work.
- `compose.yaml`: backend, Nginx frontend, and an explicit migration job.
- `openwiki/BA/`: business analysis documentation.
- `openwiki/backend-design/`, `openwiki/database-design/`, and
  `openwiki/frontend-design/`: design documentation areas, currently placeholders.
- `.agent/`: shared agent workflow references, explicitly loaded by tool configs.
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
- Keep provider credentials and personal model choices in user-level tool settings.
- Commit and push only when requested. Review status, diff, and recent history;
  stage intended files and use conventional messages matching this repository.
  Do not force-push or rewrite history without an explicit request.

## Verification

Run checks from the owning directory, using the tool's working-directory option
where available. Consult `.agent/workflows/verify.md` for the command list.
Report commands actually run, their results, and any unverified behavior.

Backend uses `uv.lock`; frontend uses `package-lock.json`. Preserve locked installs
and update the corresponding lockfile when changing dependencies.

## Runtime context

Supabase PostgreSQL is external. The backend reads separate `DB_HOST`, `DB_PORT`,
`DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `DB_SSLMODE` fields from `backend/.env`.
Passwords are raw values, not URL-encoded connection strings.

Compose publishes the UI at `http://localhost:8080` and the API on localhost port
`8000` by default. Docs are at `/api/docs` on either port. Backend readiness checks
include the database; the frontend waits for readiness at startup. Migrations run
explicitly, never on API startup. See `.agent/workflows/docker.md` for operations.
