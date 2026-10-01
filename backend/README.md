# Agentra backend

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
uv run alembic upgrade head
uv run python -m app.db.seed
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
  db/              # SQLAlchemy base, sessions, seed and live verification
    seed.py        # Transactional complete demo dataset
    verify.py      # Ledger/cache/report checks and isolated SQL regression
    sql/           # Session-local seed builders and regression fixtures
alembic/           # Versioned database migrations and immutable SQL snapshots
tests/             # API checks
```

Add domain modules as features are implemented. Routes should delegate business
logic to services. Inject `get_session` into routes and commit explicitly at the
service transaction boundary; closing a session rolls back uncommitted changes.

## Migrations

The initial database is implemented with reviewed SQL snapshots:

- `0001`: all 29 `dms` tables, domains, sequence, indexes, integrity/audit triggers,
  read models, report functions and core rules/RBAC.
- `0002`: `pg_trgm` substring search indexes, including Supabase extension-schema discovery.
- Alembic tracks the revision in `public.alembic_version`, independently of the
  DDL's transaction-local search path.

```sh
uv run alembic upgrade head
uv run alembic current
```

SQL snapshots belong to their revisions and must not be edited after deployment;
add a new reviewed revision for changes. Initial deployment fails if `dms` already
exists; it does not overwrite a legacy schema. Downgrading `0001` removes the whole
`dms` schema and its data. `0002` downgrade retains the potentially shared extension.

Application ORM models have not been mapped yet. Future models must use
`app.db.base.Base`, `schema="dms"`, the quoted camelCase SQL names and PostgreSQL
domains, and be imported in `alembic/env.py`. Autogeneration is scoped to mapped
tables to avoid dropping SQL-managed or Supabase-owned objects. Domains, views,
functions and triggers require explicit SQL migrations; they are not inferred
by Alembic. Migrations are explicit, never run on API startup.

From the repository root:

```sh
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm migrate python -m app.db.seed
```

## Demo seed and live database verification

```sh
uv run python -m app.db.seed
uv run python -m app.db.verify --seeded
uv run python -m app.db.verify --seeded --regression
```

The demo populates all 29 tables with 30 agencies, 24 products, 410 documents and
four months of trading history (June–September 2026). It covers multi-line receipts/
issues, current/historical price snapshots, FIFO cash/bank/online collections,
upfront evidence, returns, credit lots/application, cash/online refunds and pending
reservations, stock counts, drafts, cancellations, correction revisions, reversals
and automatic audit logs. Full counts and all 8 demo account credentials are in
the [root README](../README.md#tài-khoản-đăng-nhập-mẫu).

Passwords are hashed with Argon2id. Seeded tokens are random digests, all revoked;
raw tokens are discarded. Provider evidence uses `DEMO_SANDBOX` and explicitly
marked simulated payloads; the seed never calls a real gateway. These app users
are not Supabase Auth users. HTTP authentication remains unimplemented.

Seed requires revision `0002` and an empty application dataset on first run, keeps
core rules/groups/permissions created by the migration, and commits the complete
dataset atomically. An advisory transaction lock serializes seed runs. Re-running
uses a stable document creation key to identify demo v1, verifies the existing
data/password hashes, and does not append duplicates or overwrite data. Trigger
checks are forced at each posting boundary; balance caches are never written
directly. History creation runs in PostgreSQL to avoid hundreds of network trips.

The verifier reconciles documents, ledgers, balance caches, credit reservations,
audit redaction and report totals. `--regression` creates an isolated temporary
schema from the initial DDL, executes the 54 SQL checks, then rolls back the
schema and every fixture, so demo/business data are not part of the regression.
The regression requires schema-creation privileges, as migrations do.

## Checks

```sh
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

Tests use dependency overrides and do not require a live database.

Verified for this deployment: `uv sync --frozen`, `uv run alembic upgrade head`
and `uv run alembic current` (head `0002`), full seed and a second seed run with
unchanged row counts, `uv run python -m app.db.verify --seeded --regression`
(54 PostgreSQL checks passed), Ruff lint/format and pytest (5 tests passed).
The live database is Supabase PostgreSQL 17.6. Real gateway calls, concurrent
load/performance tests and Docker runtime have not been verified in this run.
