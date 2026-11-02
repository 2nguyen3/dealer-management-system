-- A correction is recorded history, not admission of a new inactive receipt product.
-- Keep every other revision guard, including first-post and stock-issue admission.
DO $migration$
DECLARE definition text;
  old_predicate text := $old$WHERE l."revisionId" = NEW.id AND (p.status <> 'ACTIVE' OR u.status <> 'ACTIVE')) THEN$old$;
  new_predicate text := $new$WHERE l."revisionId" = NEW.id AND (p.status <> 'ACTIVE' OR u.status <> 'ACTIVE')
          AND (doc.kind <> 'STOCK_RECEIPT' OR NOT EXISTS (
            SELECT 1 FROM dms.document_revision prior
            JOIN dms.document_line historical ON historical."revisionId" = prior.id
            WHERE prior."documentId" = doc.id AND prior.state = 'POSTED'
              AND historical."productId" = l."productId"
              AND historical."unitId" = l."unitId"))) THEN$new$;
BEGIN
  SELECT pg_get_functiondef('dms.guard_revision()'::regprocedure) INTO definition;
  IF position(old_predicate IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected revision guard; review before historical receipt upgrade';
  END IF;
  EXECUTE replace(definition, old_predicate, new_predicate);
END $migration$;
