-- Historical issue corrections reuse recorded goods/agency, not new-sale admission.
DO $migration$
DECLARE definition text;
  old_goods text := $old$AND (doc.kind <> 'STOCK_RECEIPT' OR NOT EXISTS (
            SELECT 1 FROM dms.document_revision prior
            JOIN dms.document_line historical ON historical."revisionId" = prior.id
            WHERE prior."documentId" = doc.id AND prior.state = 'POSTED'
              AND historical."productId" = l."productId"
              AND historical."unitId" = l."unitId"))) THEN$old$;
  new_goods text := $new$AND NOT EXISTS (
            SELECT 1 FROM dms.document_revision prior
            JOIN dms.document_line historical ON historical."revisionId" = prior.id
            WHERE prior."documentId" = doc.id AND prior.state = 'POSTED'
              AND historical."productId" = l."productId"
              AND historical."unitId" = l."unitId")) THEN$new$;
  old_agency text := $old$IF doc.kind = 'STOCK_ISSUE' AND NOT EXISTS (SELECT 1 FROM dms.agency WHERE id = doc."agencyId" AND status = 'ACTIVE') THEN$old$;
  new_agency text := $new$IF doc.kind = 'STOCK_ISSUE' AND NOT EXISTS (SELECT 1 FROM dms.agency WHERE id = doc."agencyId" AND status = 'ACTIVE')
        AND NOT EXISTS (SELECT 1 FROM dms.document_revision prior
          WHERE prior."documentId" = doc.id AND prior.state = 'POSTED') THEN$new$;
BEGIN
  SELECT pg_get_functiondef('dms.guard_revision()'::regprocedure) INTO definition;
  IF position(old_goods IN definition) = 0 OR position(old_agency IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected revision guard; review historical issue upgrade';
  END IF;
  EXECUTE replace(replace(definition, old_goods, new_goods), old_agency, new_agency);
END $migration$;
