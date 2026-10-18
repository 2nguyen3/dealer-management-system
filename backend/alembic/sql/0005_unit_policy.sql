-- Reviewed M09 repair: validate first-use quantities only after locking current policy.
-- Original SQL snapshots remain immutable. Trigger names sort before a_guard/a_unit.
CREATE FUNCTION dms.lock_recorded_unit_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM dms.unit WHERE id = NEW."unitId" FOR SHARE;
  RETURN NEW;
END $$;

CREATE TRIGGER a0_unit_policy BEFORE INSERT OR UPDATE ON dms.document_line
  FOR EACH ROW EXECUTE FUNCTION dms.lock_recorded_unit_policy();
CREATE TRIGGER a0_unit_policy BEFORE INSERT OR UPDATE ON dms.stock_count_line
  FOR EACH ROW EXECUTE FUNCTION dms.lock_recorded_unit_policy();

CREATE FUNCTION dms.guard_recorded_unit_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."allowsFraction" IS DISTINCT FROM OLD."allowsFraction" AND (
    EXISTS (SELECT 1 FROM dms.document_line WHERE "unitId" = OLD.id) OR
    EXISTS (SELECT 1 FROM dms.stock_count_line WHERE "unitId" = OLD.id)
  ) THEN
    RAISE EXCEPTION 'Recorded unit fraction policy is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_unit_recorded_fraction_policy';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER a0_fraction_policy BEFORE UPDATE ON dms.unit
  FOR EACH ROW EXECUTE FUNCTION dms.guard_recorded_unit_policy();
