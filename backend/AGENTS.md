# Backend project context

This guide applies to work inside `backend/`. It describes the current repository,
how the backend fits into the full application, and conventions for extending it.
Paths in commands are relative to `backend/` unless stated otherwise.

## Project purpose and current state

**Agentra** is the app name. DMS means **Dealer Management System**, for managing the distribution
of goods to dealers. It is an Introduction to Software Engineering course project
at the University of Information Technology, Vietnam National University Ho Chi
Minh City. The root `README.md` contains the team and course information.

The intended business scope includes:

- Dealer information and dealer operations.
- Incoming and outgoing goods and inventory management.
- Payments and outstanding dealer debt.
- Business reports.

The repository contains API infrastructure and a deployed database. The backend has
configuration, database/session setup, health endpoints, migration tooling, and
health-check tests. The frontend is a starter page that checks API availability.
The database now has 29 domain tables, PostgreSQL domains/routines/triggers/views,
two reviewed SQL Alembic revisions, core RBAC/rules and a full transactional demo
seed. Application ORM models, business endpoints, HTTP authentication and
user-level authorization are not implemented yet. Database rules are specified
in `../openwiki/database-design/`; use the versioned DDL as the schema authority.

## Technology stack

| Area | Technology and role |
| --- | --- |
| Python | Python 3.12 is the development/container target; `pyproject.toml` permits `>=3.12,<3.14`. |
| Dependencies | `uv`, with dependency definitions in `pyproject.toml` and resolved versions in `uv.lock`. |
| HTTP API | FastAPI, served by Uvicorn using an application factory. |
| Validation/configuration | Pydantic models and Pydantic Settings; database passwords use `SecretStr`. |
| Database | Supabase-hosted PostgreSQL, accessed directly from the backend. |
| ORM/driver | SQLAlchemy 2 synchronous engines and sessions, with psycopg 3. |
| Schema migrations | Alembic with reviewed SQL snapshots; metadata for future mapped models. |
| Demo passwords | Argon2id via argon2-cffi; demo credentials are in the root README. |
| Tests | pytest, FastAPI `TestClient`, HTTPX, and standard-library mocks. |
| Python quality | Ruff linting, import sorting, and formatting. |
| Frontend | React 19, TypeScript 5.9, Vite 7; ESLint and Prettier. Root setup recommends Node.js 24 LTS. |
| Deployment | Docker Compose, a Python 3.12 backend image, and an unprivileged Nginx frontend container. |

## Repository structure

```text
DMS/
├── README.md                    # Project overview and full-stack setup
├── compose.yaml                 # Backend, frontend, and migration services
├── .gitignore
├── backend/
│   ├── AGENTS.md                # This context and working guide
│   ├── README.md                # Backend setup and Supabase connection details
│   ├── pyproject.toml           # Python dependencies and Ruff/pytest configuration
│   ├── uv.lock                  # Reproducible Python dependency resolution
│   ├── .python-version         # Local Python version selection
│   ├── .env.example             # Environment template; copy to local .env
│   ├── .dockerignore
│   ├── Dockerfile              # Multi-stage backend build and liveness check
│   ├── alembic.ini             # Alembic configuration
│   ├── alembic/
│   │   ├── env.py              # Migration connection and model metadata setup
│   │   ├── script.py.mako      # Migration revision template
│   │   ├── sql/                # Immutable DDL snapshots for revisions 0001/0002
│   │   └── versions/           # Initial DMS objects and pg_trgm indexes
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # create_app factory, lifespan, CORS, API mounting
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── router.py       # Health response schema and health routes
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   └── config.py       # Validated settings and cached settings loader
│   │   └── db/
│   │       ├── __init__.py
│   │       ├── base.py         # Declarative Base and constraint naming conventions
│   │       ├── session.py      # Engine builder and request-scoped get_session
│   │       ├── seed.py         # Complete transactional demo seed
│   │       ├── verify.py       # Live integrity checks and isolated regression
│   │       └── sql/            # Session-local seed helpers and SQL regression
│   └── tests/
│       ├── test_config.py      # Credential/configuration handling
│       └── test_health.py      # Liveness, readiness, and database-error responses
└── ui/
    ├── AGENTS.md               # Frontend-local agent guide
    ├── README.md               # Frontend setup
    ├── package.json            # JavaScript dependencies and scripts
    ├── package-lock.json       # Reproducible JavaScript dependency resolution
    ├── .env.example            # Frontend environment template
    ├── .dockerignore
    ├── Dockerfile              # Frontend build and Nginx runtime
    ├── nginx.conf              # Static hosting and /api/ reverse proxy
    ├── index.html              # Browser entry document
    ├── vite.config.ts          # React plugin and local API proxy
    ├── tsconfig*.json          # TypeScript project configuration
    ├── eslint.config.js        # JavaScript/TypeScript lint configuration
    ├── .prettierrc.json        # Formatting configuration
    ├── .prettierignore
    └── src/
        ├── main.tsx            # React application entry point
        ├── styles.css          # Application styles
        ├── app/App.tsx         # Starter page and API availability state
        └── lib/api.ts          # API base URL and health-check fetch helper
```

Local environments and generated files such as `.venv/`, `__pycache__/`,
`.pytest_cache/`, `.ruff_cache/`, `node_modules/`, and build output are omitted.

## Architecture and request flow

1. The browser runs the React frontend. Its API helper defaults to `/api/v1`,
   with an optional `VITE_API_BASE_URL` override.
2. Locally, Vite serves port `5173` and proxies `/api` to `127.0.0.1:8000`.
   In Docker, Nginx serves the frontend and proxies `/api/` to the backend over
   the internal Compose network.
3. `app.main.create_app()` loads settings, configures CORS, and mounts the API
   router under `/api/v1`.
4. The application lifespan creates an engine on `app.state.engine` and disposes
   it on shutdown. Creating the engine does not require an immediate DB connection.
5. Routes needing a database use `Depends(get_session)` to receive a synchronous,
   request-scoped SQLAlchemy `Session`.
6. Sessions close after the request. Services must commit explicitly at their
   transaction boundary; uncommitted changes are rolled back when sessions close.

Supabase handles connection pooling. `build_engine()` uses `NullPool`, disables
psycopg prepared statements with `prepare_threshold=None`, and sets a five-second
connection timeout. This is a direct server-side PostgreSQL integration, not a
Supabase client SDK integration; Supabase API keys are not required.

### Existing HTTP interface

| Method/path | Behavior |
| --- | --- |
| `GET /api/v1/health` | Liveness; returns `200` with `{"status":"ok"}` without querying the database. |
| `GET /api/v1/health/ready` | Executes `SELECT 1`; returns `200` with `{"status":"ok"}` or `503` with `{"detail":"Database unavailable"}` on a SQLAlchemy error. |
| `/api/docs` | Swagger UI. |
| `/api/redoc` | ReDoc documentation. |
| `/api/openapi.json` | OpenAPI schema. |

Readiness failures log a generic warning and return a generic error rather than
database exception details. The Docker image defaults to a **liveness** check;
Compose overrides it with **database readiness**, so Compose startup requires
valid database credentials and a reachable Supabase database.

## Environment configuration

`app/core/config.py` loads `.env` relative to the working directory, ignores extra
settings, and caches `get_settings()`. Run backend commands from `backend/`.

| Variable | Requirement/default |
| --- | --- |
| `APP_NAME` | Optional; defaults to `Agentra API`. |
| `DB_HOST` | Required PostgreSQL hostname. |
| `DB_PORT` | Defaults to `5432`; must be between 1 and 65535. |
| `DB_NAME` | Defaults to `postgres`. |
| `DB_USER` | Required database username. |
| `DB_PASSWORD` | Required nonempty raw password, stored as `SecretStr`. |
| `DB_SSLMODE` | Defaults to `require`. |
| `CORS_ORIGINS` | JSON array; defaults to `["http://localhost:5173"]`. |

Copy `.env.example` to `.env`, verify the connection fields against Supabase's
Connect panel, and fill in `DB_PASSWORD`. The template includes the project's
session-pooler host and username but leaves the password blank. Keep
`DB_SSLMODE=require`; enter the raw password in single quotes without URL-encoding.
`Settings.database_url()` builds a SQLAlchemy URL object internally. Both the API
and Alembic use these `DB_*` fields; connection-string environment settings are no
longer used. The session pooler on port `5432` supports IPv4. If runtime uses
transaction pooling, override the host/port for migrations to use a direct or
session-pooler connection. The direct endpoint may require IPv6.

Keep credentials in backend environment files, which are ignored by Git, and
commit only example templates. Frontend `VITE_*` settings are browser-visible.
The current CORS setup disables credentials and allows configured origins,
common API methods, and `Authorization`/`Content-Type` headers. Authentication
and authorization still need implementation for business features; a connection
using the database's `postgres` role does not enforce end-user RLS policies.

## Development and verification commands

From `backend/`, after configuring `.env`:

```sh
uv sync --frozen
uv run alembic upgrade head
uv run python -m app.db.seed
uv run uvicorn app.main:create_app --factory --reload
```

The API runs at `http://localhost:8000`; docs are at `/api/docs`.

Backend checks:

```sh
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

For database changes, additionally run from `backend/` with configured `.env`:

```sh
uv run alembic current
uv run python -m app.db.verify --seeded --regression
```

Live verification reconciles 29 tables, 58 timestamp columns, documents, balances,
credit reservations, audit redaction and reports. It verifies all demo account
password hashes. Regression adds 54 assertions/rejections in an isolated schema
that is always rolled back; it requires schema-creation privileges. Unit tests
remain independent of Supabase. See `../.agents/workflows/verify.md` for shared checks.

Ruff targets Python 3.12, uses a 100-character line length, and enables `E`, `F`,
`I`, `UP`, and `B` rules. pytest discovers tests in `tests/` with the backend root
on the Python path. Existing tests supply settings with `_env_file=None`, override
`get_session` with a mock for readiness, and use `TestClient` as a context manager
to run the application lifespan. They do not require a live database.

For the frontend, run `npm ci` and `npm run dev` from `ui/` in another terminal.
Frontend checks are `npm run typecheck`, `npm run lint`, `npm run format:check`,
and `npm run build`.

## Database migrations

The complete schema is versioned in `alembic/sql/0001_initial.sql` and
`alembic/sql/0002_search_indexes.sql`. Revisions execute those snapshots inside
Alembic's transaction; revision tracking is in `public.alembic_version` so the
DDL's local search path cannot hide it.

```sh
uv run alembic upgrade head
uv run alembic current
```

Revisions `0001` and `0002` contain the reviewed initial DDL and search indexes.
Use `uv run alembic upgrade head`, then `uv run python -m app.db.seed` for the
demo. Verify with `uv run python -m app.db.verify --seeded --regression`.
Do not edit deployed SQL snapshots; add a new revision. Autogeneration includes
only explicitly mapped tables so it does not drop SQL-managed/Supabase objects.
Review generated migrations before applying them.
Run migrations explicitly; application startup does not apply migrations or
create tables.

When adding ORM models, use `app.db.base.Base`, `schema="dms"` and the existing
quoted camelCase SQL column names. Register models in `alembic/env.py`.
Domains, triggers, functions and views need explicit reviewed SQL; Alembic cannot
infer their full behavior. Downgrading `0001` removes the schema and all its data.

## Demo seed conventions

`app/db/seed.py` seeds all 29 tables transactionally with a stable dataset marker
and an advisory lock. A first run requires empty application data; a repeat run
verifies demo v1 and leaves its row counts/passwords unchanged. Session-local
`pg_temp` helpers in `app/db/sql/seed_helpers.sql` are not business API services.

Keep the seed realistic and internally reconciled: include multi-line documents,
historical price snapshots, FIFO payments, upfront evidence, returns, credit,
refund states/reservations, counts, corrections, cancellations and audit. Never
disable constraints/triggers or write caches directly to make seed data pass.
Force deferred constraints at business boundaries and report success after commit.

Use Argon2id for app passwords. Seed token digests are random and revoked; raw
tokens are discarded. Payment/refund evidence is explicitly simulated under
`DEMO_SANDBOX`; no real provider calls. These users belong to `dms.app_user`, not
Supabase Auth. Root README lists all 8 credentials, including one locked user.

## Docker deployment

From the repository root, with `backend/.env` configured:

```sh
docker compose build
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm migrate python -m app.db.seed
docker compose up -d --wait --wait-timeout 120
docker compose ps
```

- `backend` runs Uvicorn on port `8000` as a non-root user, published on
  `127.0.0.1:8000` for direct local access. Docs: `http://localhost:8000/api/docs`.
- `API_PORT` can override the default localhost-only backend port.
- `frontend` publishes `${WEB_PORT:-8080}:8080` and waits for backend database readiness.
- `migrate` is a one-off service in the `tools` profile running `alembic upgrade head`.
- PostgreSQL remains external on Supabase; Compose does not start a local database.
- The default application URL is `http://localhost:8080`, with docs at `/api/docs`.
- Compose health checks run every 30 seconds; the migration job disables HTTP health
  checks. All services use the `app` bridge network and rotated JSON logs (10 MB,
  three files). Shutdown grace periods are 30 seconds for backend/migrations and
  15 seconds for frontend. An unhealthy status alone does not restart a container.

## Conventions for extending the backend

- Preserve the `create_app(settings: Settings | None = None)` factory and lifespan
  resource management so tests can inject configuration.
- Keep HTTP routes and request/response schemas in the API layer. Add domain
  modules incrementally and delegate business logic from routes to services,
  following the guidance in `backend/README.md`.
- Use the existing synchronous SQLAlchemy session dependency and explicit service
  transaction boundaries. Place ORM models on the shared declarative Base.
- Mount new API routes through the existing `/api/v1` router structure and use
  typed Pydantic request/response models.
- Add schema changes as reviewed Alembic revisions and register model imports
  for autogeneration.
- Keep configuration centralized in `Settings`; update `.env.example` when
  introducing a setting and preserve credential-safe errors and logging.
- Follow the configured Ruff rules and existing typed Python style. Run the
  relevant backend checks after changing Python behavior.
- Keep this guide aligned with the actual implementation as domain features and
  folders are introduced. See `../README.md`, `README.md`, and `../ui/README.md`
  for the supporting setup documentation.
