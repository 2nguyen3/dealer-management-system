-- Standalone psql regression entry point (expects seed.example.sql).
-- Backend: uv run python -m app.db.verify --regression.
-- All helpers and fixtures are rolled back.
BEGIN;
\ir ../../backend/app/db/sql/regression.sql
ROLLBACK;
