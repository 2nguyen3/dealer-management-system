-- PostgreSQL reference entry point. The reviewed snapshot is versioned with Alembic.
-- Backend/Supabase deployment: cd backend && uv run alembic upgrade head.
-- psql standalone, NEW schema only:
BEGIN;
\ir ../../backend/alembic/sql/0001_initial.sql
COMMIT;
