# DMS backend

FastAPI, Pydantic Settings, SQLAlchemy 2, psycopg 3, and Alembic. Python 3.12
and [uv](https://docs.astral.sh/uv/) are required for local development.

## Local development

Run from `backend/`:

```sh
uv sync --frozen
```

Copy `.env.example` to `.env`, then fill in `DB_PASSWORD` and verify `DB_HOST`,
`DB_PORT`, `DB_NAME`, and `DB_USER` using Supabase's **Connect** panel. Start the server:

```sh
uv run uvicorn app.main:create_app --factory --reload
```

- Swagger UI: http://localhost:8000/api/docs
- Liveness: http://localhost:8000/api/v1/health
- Database readiness: http://localhost:8000/api/v1/health/ready

Liveness does not open a database connection. Readiness executes `SELECT 1`
and returns 503 if Postgres is unavailable.

## Supabase connection

Configure the database with separate environment variables:

- `DB_HOST`: Supabase pooler hostname.
- `DB_PORT`: PostgreSQL port, default `5432`.
- `DB_NAME`: Database name, default `postgres`.
- `DB_USER`: Supabase database username, including the project suffix for the pooler.
- `DB_PASSWORD`: Required raw password; do not URL-encode it. Use single quotes in `.env`.
- `DB_SSLMODE`: SSL mode, default `require`.

The example contains this project's session-pooler host and username but no password.
The **session pooler** on port 5432 supports IPv4 hosts. Settings build a SQLAlchemy
URL object internally, preserving reserved characters in the password. Empty
passwords are rejected. `DATABASE_URL` and `MIGRATION_DATABASE_URL` are no longer used.

The application disables psycopg prepared statements and uses `NullPool` so
Supabase handles connection pooling. A transaction-pooler runtime URL is also
supported. Alembic uses the same `DB_*` settings; run migrations with a direct or
session-pooler host and port. If runtime uses transaction pooling, override those
settings for the migration process. The direct endpoint may require IPv6.

This is a server-side Postgres connection. Supabase API keys are not needed.
Keep database credentials on the backend. Authentication and user-level
authorization must be implemented before exposing business data; connecting
with the database's `postgres` role does not enforce end-user RLS policies.

## Structure

```text
app/
  main.py          # Application factory and resource lifecycle
  api/             # HTTP routes and request/response schemas
  core/            # Validated environment configuration
  db/              # SQLAlchemy base and request-scoped sessions
alembic/           # Versioned database migrations
tests/             # API checks
```

Add domain modules as features are implemented. Routes should delegate business
logic to services. Inject `get_session` into routes and commit explicitly at the
service transaction boundary; closing a session rolls back uncommitted changes.

## Migrations

There are no application tables or initial migrations yet. Define models using
`app.db.base.Base` and import their modules in `alembic/env.py` so autogeneration
can discover them:

```sh
uv run alembic revision --autogenerate -m "create initial tables"
uv run alembic upgrade head
```

Review generated migrations before applying them, especially against a Supabase
project containing existing tables. Migrations are run explicitly, never on
every API startup. From the repository root, deploy migrations with:

```sh
docker compose --profile tools run --rm migrate
```

## Checks

```sh
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

Tests use dependency overrides and do not require a live database.
