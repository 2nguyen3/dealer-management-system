-- Standalone psql regression entry point for the 0011 schema (run DMS.sql first).
-- Backend (authoritative): uv run python -m app.db.verify --regression, which runs the
-- same file in an isolated renamed copy of the 0011 schema. Prefer an unseeded dms schema.
-- All helpers and fixtures are rolled back.
BEGIN;
\ir ../../backend/app/db/sql/regression.sql
ROLLBACK;
