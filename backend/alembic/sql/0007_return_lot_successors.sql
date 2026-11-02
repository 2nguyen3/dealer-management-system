-- A rounding-only successor must retain the original lot identity used by active
-- reservations and paid refunds. Do not rewrite credit_lot or immutable evidence.
DO $migration$
DECLARE definition text; original_guard text; replacement_guard text;
BEGIN
  SELECT pg_get_functiondef('dms.guard_ledger()'::regprocedure) INTO definition;
  original_guard := 'WHERE id = NEW."lotId" AND "sourceRevisionId" = source_revision.id';
  replacement_guard := 'WHERE id = NEW."lotId" AND ("sourceRevisionId" = source_revision.id
      OR (source_doc.kind = ''SALES_RETURN''
        AND source_doc."currentRevisionId" = source_revision.id
        AND source_revision.state = ''POSTED''
        AND EXISTS (SELECT 1 FROM dms.document_revision original_source
          WHERE original_source.id = "sourceRevisionId"
            AND original_source."documentId" = source_doc.id
            AND original_source.state = ''POSTED'')))';
  IF position(original_guard IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected guard_ledger definition; review migration prerequisites';
  END IF;
  EXECUTE replace(definition, original_guard, replacement_guard);
END $migration$;
