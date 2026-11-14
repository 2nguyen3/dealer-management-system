-- Substring search indexes (pg_trgm GIN on lower(agency.name) and lower(product.name))
-- are part of revision 0011 (backend/alembic/sql/0011_simplified_schema.sql), so DMS.sql
-- already creates them. Running the historical 0002 snapshot again would fail with
-- duplicate index names. This file is kept as a no-op for older instructions.
SELECT 'search indexes are included in 0011' AS info;
