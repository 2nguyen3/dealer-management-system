-- Reviewed D02 repair. Preserve every business-reference FK and ledger guard.
SET LOCAL search_path TO dms, public;

CREATE FUNCTION guard_eligible_owner_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'product' THEN
    PERFORM 1 FROM dms.inventory_balance WHERE "productId"=OLD.id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM dms.inventory_balance WHERE "productId"=OLD.id
      AND ("currentStock"<>0 OR "currentPurchasePrice"<>0 OR "priceSourceLineId" IS NOT NULL))
      OR EXISTS (SELECT 1 FROM dms.document_line WHERE "productId"=OLD.id)
      OR EXISTS (SELECT 1 FROM dms.stock_count_line WHERE "productId"=OLD.id)
      OR EXISTS (SELECT 1 FROM dms.inventory_entry WHERE "productId"=OLD.id) THEN
      RAISE EXCEPTION 'Product has recorded usage' USING ERRCODE='23514', CONSTRAINT='ck_owner_eligible_deletion';
    END IF;
  ELSE
    PERFORM 1 FROM dms.agency_balance WHERE "agencyId"=OLD.id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM dms.agency_balance WHERE "agencyId"=OLD.id
      AND ("currentDebt"<>0 OR "currentCredit"<>0))
      OR EXISTS (SELECT 1 FROM dms.document WHERE "agencyId"=OLD.id)
      OR EXISTS (SELECT 1 FROM dms.online_payment WHERE "agencyId"=OLD.id)
      OR EXISTS (SELECT 1 FROM dms.receivable_entry WHERE "agencyId"=OLD.id)
      OR EXISTS (SELECT 1 FROM dms.credit_lot WHERE "agencyId"=OLD.id)
      OR EXISTS (SELECT 1 FROM dms.credit_entry WHERE "agencyId"=OLD.id) THEN
      RAISE EXCEPTION 'Agency has recorded usage' USING ERRCODE='23514', CONSTRAINT='ck_owner_eligible_deletion';
    END IF;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER a0_eligible_delete BEFORE DELETE ON product FOR EACH ROW EXECUTE FUNCTION guard_eligible_owner_deletion();
CREATE TRIGGER a0_eligible_delete BEFORE DELETE ON agency FOR EACH ROW EXECUTE FUNCTION guard_eligible_owner_deletion();

ALTER TABLE inventory_balance DROP CONSTRAINT "inventory_balance_productId_fkey";
ALTER TABLE inventory_balance ADD CONSTRAINT "inventory_balance_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES product(id) ON DELETE CASCADE;
ALTER TABLE agency_balance DROP CONSTRAINT "agency_balance_agencyId_fkey";
ALTER TABLE agency_balance ADD CONSTRAINT "agency_balance_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION protect_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF pg_trigger_depth()>1 THEN
      IF TG_TABLE_NAME='inventory_balance' THEN
        IF OLD."currentStock"=0 AND OLD."currentPurchasePrice"=0 AND OLD."priceSourceLineId" IS NULL
          AND NOT EXISTS (SELECT 1 FROM dms.product WHERE id=OLD."productId") THEN RETURN OLD; END IF;
      ELSIF TG_TABLE_NAME='agency_balance' THEN
        IF OLD."currentDebt"=0 AND OLD."currentCredit"=0
          AND NOT EXISTS (SELECT 1 FROM dms.agency WHERE id=OLD."agencyId") THEN RETURN OLD; END IF;
      END IF;
    END IF;
    RAISE EXCEPTION 'Only eligible owner deletion may remove a zero cache' USING ERRCODE='23514';
  END IF;
  IF pg_trigger_depth()<2 THEN
    RAISE EXCEPTION 'Balance caches are maintained by deferred ledger checks' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

-- First use must serialize with product unit updates, not merely FK key locks.
CREATE FUNCTION lock_recorded_product_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM dms.product WHERE id=NEW."productId" FOR SHARE;
  RETURN NEW;
END $$;
CREATE TRIGGER a0_product_policy BEFORE INSERT OR UPDATE ON document_line FOR EACH ROW EXECUTE FUNCTION lock_recorded_product_policy();
CREATE TRIGGER a0_product_policy BEFORE INSERT OR UPDATE ON stock_count_line FOR EACH ROW EXECUTE FUNCTION lock_recorded_product_policy();

CREATE FUNCTION guard_recorded_product_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."unitId"<>OLD."unitId" AND (
    EXISTS (SELECT 1 FROM dms.document_line WHERE "productId"=OLD.id)
    OR EXISTS (SELECT 1 FROM dms.stock_count_line WHERE "productId"=OLD.id)) THEN
    RAISE EXCEPTION 'Recorded product unit cannot change' USING ERRCODE='23514', CONSTRAINT='ck_product_recorded_unit_policy';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER a0_recorded_policy BEFORE UPDATE ON product FOR EACH ROW EXECUTE FUNCTION guard_recorded_product_policy();

-- Serialize draft/history dates with agency acceptance edits. Parent FOR SHARE
-- conflicts with profile UPDATE without requiring revision locks in that writer.
CREATE FUNCTION lock_document_agency_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM dms.agency WHERE id=(
    SELECT "agencyId" FROM dms.document WHERE id=NEW."documentId") FOR SHARE;
  RETURN NEW;
END $$;
CREATE TRIGGER a0_agency_history BEFORE INSERT OR UPDATE ON document_revision
  FOR EACH ROW EXECUTE FUNCTION lock_document_agency_history();

CREATE FUNCTION guard_agency_history_date() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM dms.document d JOIN dms.document_revision r ON r."documentId"=d.id
    WHERE d."agencyId"=NEW.id AND r."businessDate"<NEW."acceptedDate") THEN
    RAISE EXCEPTION 'Accepted date is after recorded history'
      USING ERRCODE='23514', CONSTRAINT='ck_agency_history_date';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER a0_history_date BEFORE UPDATE OF "acceptedDate" ON agency
  FOR EACH ROW EXECUTE FUNCTION guard_agency_history_date();
