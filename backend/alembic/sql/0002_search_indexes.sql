-- Optional substring search indexes. PostgreSQL/Supabase pg_trgm extension.
-- Supports lower(name) LIKE '%term%' / ILIKE; terms >= 3 characters benefit most.
DO $$ DECLARE extension_schema text;
BEGIN
  SELECT n.nspname INTO extension_schema FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
  IF extension_schema IS NULL THEN
    CREATE EXTENSION pg_trgm WITH SCHEMA dms;
    extension_schema := 'dms';
  END IF;
  -- Supabase may already install pg_trgm in extensions, not public/dms.
  EXECUTE format('CREATE INDEX ix_agency_name_contains ON dms.agency USING gin (lower(name) %I.gin_trgm_ops)', extension_schema);
  EXECUTE format('CREATE INDEX ix_product_name_contains ON dms.product USING gin (lower(name) %I.gin_trgm_ops)', extension_schema);
END $$;
