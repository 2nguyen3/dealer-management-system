-- PostgreSQL reference entry point. The reviewed snapshot is versioned with Alembic.
-- Backend/Supabase deployment: cd backend && uv run alembic upgrade head.
-- psql standalone, NEW schema only:
BEGIN;
\ir ../../backend/alembic/sql/0001_initial.sql
-- Revision 0010 replaces district with the read-only HCMC 2025 ward catalogue.
\ir ../../backend/alembic/sql/0010_hcmc_wards.sql
COMMIT;
