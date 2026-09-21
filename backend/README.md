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
