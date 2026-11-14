-- PostgreSQL reference entry point. The reviewed snapshots are versioned with Alembic.
-- Backend/Neon deployment: cd backend && uv run alembic upgrade head.
-- psql standalone: revision 0011 DROPS and rebuilds the whole dms schema (16 tables,
-- simplified 2026-11-14 model). It records no Alembic version and keeps no data.
BEGIN;
\ir ../../backend/alembic/sql/0011_simplified_schema.sql
COMMIT;
