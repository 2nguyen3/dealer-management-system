-- Optional standalone psql entry point; backend deployment includes revision 0002.
BEGIN;
\ir ../../backend/alembic/sql/0002_search_indexes.sql
COMMIT;
