# DMS backend

FastAPI, Pydantic Settings, SQLAlchemy 2, psycopg 3, and Alembic. Python 3.12
and [uv](https://docs.astral.sh/uv/) are required for local development.

## Local development

Run from `backend/`:

```sh
uv sync --frozen
```

Copy `.env.example` to `.env`, then set `DATABASE_URL` using your Supabase
dashboard's **Connect** panel. Start the server:

```sh
uv run uvicorn app.main:create_app --factory --reload
```

- Swagger UI: http://localhost:8000/api/docs
- Liveness: http://localhost:8000/api/v1/health
- Database readiness: http://localhost:8000/api/v1/health/ready

Liveness does not open a database connection. Readiness executes `SELECT 1`
and returns 503 if Postgres is unavailable.

## Supabase connection

Use `postgresql+psycopg://` as the URL scheme and include `?sslmode=require`.
The **session pooler** on port 5432 is a good default, including on IPv4-only
hosts. Use the exact hostname and username shown for your project; the values
in `.env.example` are placeholders. Percent-encode reserved password characters
such as `@`, `:`, `/`, `#`, and `%`.

The application disables psycopg prepared statements and uses `NullPool` so
Supabase handles connection pooling. A transaction-pooler runtime URL is also
supported. For migrations, use a direct or session-pooler connection through
`MIGRATION_DATABASE_URL`; the direct endpoint may require IPv6.
