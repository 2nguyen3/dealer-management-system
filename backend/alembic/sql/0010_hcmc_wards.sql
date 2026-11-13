-- HCMC 2025 administrative units replace the abolished district level (D1-D4).
-- Legal basis: Nghị quyết 1685/NQ-UBTVQH15, operative 2025-07-01.
-- Data source (cited, never read at runtime): openwiki/database-design/hcmc_wards_2025.json,
-- itself from https://provinces.open-api.vn/api/v2/p/79?depth=2 (GSO codes), retrieved
-- 2026-11-13. 168 units = 113 WARD + 54 COMMUNE + 1 SPECIAL_ZONE. The VALUES below were
-- generated from that file and reviewed; any later correction needs a new revision.
SET LOCAL search_path TO dms, public;
SELECT set_config('dms.request_id', 'alembic-0010-hcmc-wards', true);

-- Read-only reference catalogue: loaded here, no status column and no runtime writers.
CREATE TABLE ward (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[0-9]{5}$'),
  name text NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  kind text NOT NULL CHECK (kind IN ('WARD', 'COMMUNE', 'SPECIAL_ZONE')),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER z_stamp BEFORE INSERT OR UPDATE ON ward FOR EACH ROW EXECUTE FUNCTION stamp_row();
INSERT INTO ward (code, name, kind) VALUES
  ('25747', 'Phường Thủ Dầu Một', 'WARD'),
  ('25750', 'Phường Phú Lợi', 'WARD'),
  ('25760', 'Phường Bình Dương', 'WARD'),
  ('25768', 'Phường Phú An', 'WARD'),
  ('25771', 'Phường Chánh Hiệp', 'WARD'),
  ('25777', 'Xã Dầu Tiếng', 'COMMUNE'),
  ('25780', 'Xã Minh Thạnh', 'COMMUNE'),
  ('25792', 'Xã Long Hòa', 'COMMUNE'),
  ('25807', 'Xã Thanh An', 'COMMUNE'),
  ('25813', 'Phường Bến Cát', 'WARD'),
  ('25819', 'Xã Trừ Văn Thố', 'COMMUNE'),
  ('25822', 'Xã Bàu Bàng', 'COMMUNE'),
  ('25837', 'Phường Chánh Phú Hòa', 'WARD'),
  ('25840', 'Phường Long Nguyên', 'WARD'),
  ('25843', 'Phường Tây Nam', 'WARD'),
  ('25846', 'Phường Thới Hòa', 'WARD'),
  ('25849', 'Phường Hòa Lợi', 'WARD'),
  ('25858', 'Xã Phú Giáo', 'COMMUNE'),
  ('25864', 'Xã Phước Thành', 'COMMUNE'),
  ('25867', 'Xã An Long', 'COMMUNE'),
  ('25882', 'Xã Phước Hòa', 'COMMUNE'),
  ('25888', 'Phường Tân Uyên', 'WARD'),
  ('25891', 'Phường Tân Khánh', 'WARD'),
  ('25906', 'Xã Bắc Tân Uyên', 'COMMUNE'),
  ('25909', 'Xã Thường Tân', 'COMMUNE'),
  ('25912', 'Phường Vĩnh Tân', 'WARD'),
  ('25915', 'Phường Bình Cơ', 'WARD'),
  ('25920', 'Phường Tân Hiệp', 'WARD'),
  ('25942', 'Phường Dĩ An', 'WARD'),
  ('25945', 'Phường Tân Đông Hiệp', 'WARD'),
  ('25951', 'Phường Đông Hòa', 'WARD'),
  ('25966', 'Phường Lái Thiêu', 'WARD'),
  ('25969', 'Phường Thuận Giao', 'WARD'),
  ('25975', 'Phường An Phú', 'WARD'),
  ('25978', 'Phường Thuận An', 'WARD'),
  ('25987', 'Phường Bình Hòa', 'WARD'),
  ('26506', 'Phường Vũng Tàu', 'WARD'),
  ('26526', 'Phường Tam Thắng', 'WARD'),
  ('26536', 'Phường Rạch Dừa', 'WARD'),
  ('26542', 'Phường Phước Thắng', 'WARD'),
  ('26545', 'Xã Long Sơn', 'COMMUNE'),
  ('26560', 'Phường Bà Rịa', 'WARD'),
  ('26566', 'Phường Long Hương', 'WARD'),
  ('26572', 'Phường Tam Long', 'WARD'),
  ('26575', 'Xã Ngãi Giao', 'COMMUNE'),
  ('26584', 'Xã Xuân Sơn', 'COMMUNE'),
  ('26590', 'Xã Bình Giã', 'COMMUNE'),
  ('26596', 'Xã Châu Đức', 'COMMUNE'),
  ('26608', 'Xã Kim Long', 'COMMUNE'),
  ('26617', 'Xã Nghĩa Thành', 'COMMUNE'),
  ('26620', 'Xã Hồ Tràm', 'COMMUNE'),
  ('26632', 'Xã Xuyên Mộc', 'COMMUNE'),
  ('26638', 'Xã Bàu Lâm', 'COMMUNE'),
  ('26641', 'Xã Hòa Hội', 'COMMUNE'),
  ('26647', 'Xã Hòa Hiệp', 'COMMUNE'),
  ('26656', 'Xã Bình Châu', 'COMMUNE'),
  ('26659', 'Xã Long Điền', 'COMMUNE'),
  ('26662', 'Xã Long Hải', 'COMMUNE'),
  ('26680', 'Xã Đất Đỏ', 'COMMUNE'),
  ('26686', 'Xã Phước Hải', 'COMMUNE'),
  ('26704', 'Phường Phú Mỹ', 'WARD'),
  ('26710', 'Phường Tân Hải', 'WARD'),
  ('26713', 'Phường Tân Phước', 'WARD'),
  ('26725', 'Phường Tân Thành', 'WARD'),
  ('26728', 'Xã Châu Pha', 'COMMUNE'),
  ('26732', 'Đặc khu Côn Đảo', 'SPECIAL_ZONE'),
  ('26737', 'Phường Tân Định', 'WARD'),
  ('26740', 'Phường Sài Gòn', 'WARD'),
  ('26743', 'Phường Bến Thành', 'WARD'),
  ('26758', 'Phường Cầu Ông Lãnh', 'WARD'),
  ('26767', 'Phường An Phú Đông', 'WARD'),
  ('26773', 'Phường Thới An', 'WARD'),
  ('26782', 'Phường Tân Thới Hiệp', 'WARD'),
  ('26785', 'Phường Trung Mỹ Tây', 'WARD'),
  ('26791', 'Phường Đông Hưng Thuận', 'WARD'),
  ('26800', 'Phường Linh Xuân', 'WARD'),
  ('26803', 'Phường Tam Bình', 'WARD'),
  ('26809', 'Phường Hiệp Bình', 'WARD'),
  ('26824', 'Phường Thủ Đức', 'WARD'),
  ('26833', 'Phường Long Bình', 'WARD'),
  ('26842', 'Phường Tăng Nhơn Phú', 'WARD'),
  ('26848', 'Phường Phước Long', 'WARD'),
  ('26857', 'Phường Long Phước', 'WARD'),
  ('26860', 'Phường Long Trường', 'WARD'),
  ('26876', 'Phường An Nhơn', 'WARD'),
  ('26878', 'Phường An Hội Đông', 'WARD'),
  ('26882', 'Phường An Hội Tây', 'WARD'),
  ('26884', 'Phường Gò Vấp', 'WARD'),
  ('26890', 'Phường Hạnh Thông', 'WARD'),
  ('26898', 'Phường Thông Tây Hội', 'WARD'),
  ('26905', 'Phường Bình Lợi Trung', 'WARD'),
  ('26911', 'Phường Bình Quới', 'WARD'),
  ('26929', 'Phường Bình Thạnh', 'WARD'),
  ('26944', 'Phường Gia Định', 'WARD'),
  ('26956', 'Phường Thạnh Mỹ Tây', 'WARD'),
  ('26968', 'Phường Tân Sơn Nhất', 'WARD'),
  ('26977', 'Phường Tân Sơn Hòa', 'WARD'),
  ('26983', 'Phường Bảy Hiền', 'WARD'),
  ('26995', 'Phường Tân Hòa', 'WARD'),
  ('27004', 'Phường Tân Bình', 'WARD'),
  ('27007', 'Phường Tân Sơn', 'WARD'),
  ('27013', 'Phường Tây Thạnh', 'WARD'),
  ('27019', 'Phường Tân Sơn Nhì', 'WARD'),
  ('27022', 'Phường Phú Thọ Hòa', 'WARD'),
  ('27028', 'Phường Phú Thạnh', 'WARD'),
  ('27031', 'Phường Tân Phú', 'WARD'),
  ('27043', 'Phường Đức Nhuận', 'WARD'),
  ('27058', 'Phường Cầu Kiệu', 'WARD'),
  ('27073', 'Phường Phú Nhuận', 'WARD'),
  ('27094', 'Phường An Khánh', 'WARD'),
  ('27097', 'Phường Bình Trưng', 'WARD'),
  ('27112', 'Phường Cát Lái', 'WARD'),
  ('27139', 'Phường Xuân Hòa', 'WARD'),
  ('27142', 'Phường Nhiêu Lộc', 'WARD'),
  ('27154', 'Phường Bàn Cờ', 'WARD'),
  ('27163', 'Phường Hòa Hưng', 'WARD'),
  ('27169', 'Phường Diên Hồng', 'WARD'),
  ('27190', 'Phường Vườn Lài', 'WARD'),
  ('27211', 'Phường Hòa Bình', 'WARD'),
  ('27226', 'Phường Phú Thọ', 'WARD'),
  ('27232', 'Phường Bình Thới', 'WARD'),
  ('27238', 'Phường Minh Phụng', 'WARD'),
  ('27259', 'Phường Xóm Chiếu', 'WARD'),
  ('27265', 'Phường Khánh Hội', 'WARD'),
  ('27286', 'Phường Vĩnh Hội', 'WARD'),
  ('27301', 'Phường Chợ Quán', 'WARD'),
  ('27316', 'Phường An Đông', 'WARD'),
  ('27343', 'Phường Chợ Lớn', 'WARD'),
  ('27349', 'Phường Phú Lâm', 'WARD'),
  ('27364', 'Phường Bình Phú', 'WARD'),
  ('27367', 'Phường Bình Tây', 'WARD'),
  ('27373', 'Phường Bình Tiên', 'WARD'),
  ('27418', 'Phường Chánh Hưng', 'WARD'),
  ('27424', 'Phường Bình Đông', 'WARD'),
  ('27427', 'Phường Phú Định', 'WARD'),
  ('27439', 'Phường Bình Hưng Hòa', 'WARD'),
  ('27442', 'Phường Bình Tân', 'WARD'),
  ('27448', 'Phường Bình Trị Đông', 'WARD'),
  ('27457', 'Phường Tân Tạo', 'WARD'),
  ('27460', 'Phường An Lạc', 'WARD'),
  ('27475', 'Phường Tân Hưng', 'WARD'),
  ('27478', 'Phường Tân Thuận', 'WARD'),
  ('27484', 'Phường Phú Thuận', 'WARD'),
  ('27487', 'Phường Tân Mỹ', 'WARD'),
  ('27496', 'Xã Tân An Hội', 'COMMUNE'),
  ('27508', 'Xã An Nhơn Tây', 'COMMUNE'),
  ('27511', 'Xã Nhuận Đức', 'COMMUNE'),
  ('27526', 'Xã Thái Mỹ', 'COMMUNE'),
  ('27541', 'Xã Phú Hòa Đông', 'COMMUNE'),
  ('27544', 'Xã Bình Mỹ', 'COMMUNE'),
  ('27553', 'Xã Củ Chi', 'COMMUNE'),
  ('27559', 'Xã Hóc Môn', 'COMMUNE'),
  ('27568', 'Xã Đông Thạnh', 'COMMUNE'),
  ('27577', 'Xã Xuân Thới Sơn', 'COMMUNE'),
  ('27592', 'Xã Bà Điểm', 'COMMUNE'),
  ('27595', 'Xã Tân Nhựt', 'COMMUNE'),
  ('27601', 'Xã Vĩnh Lộc', 'COMMUNE'),
  ('27604', 'Xã Tân Vĩnh Lộc', 'COMMUNE'),
  ('27610', 'Xã Bình Lợi', 'COMMUNE'),
  ('27619', 'Xã Bình Hưng', 'COMMUNE'),
  ('27628', 'Xã Hưng Long', 'COMMUNE'),
  ('27637', 'Xã Bình Chánh', 'COMMUNE'),
  ('27655', 'Xã Nhà Bè', 'COMMUNE'),
  ('27658', 'Xã Hiệp Phước', 'COMMUNE'),
  ('27664', 'Xã Cần Giờ', 'COMMUNE'),
  ('27667', 'Xã Bình Khánh', 'COMMUNE'),
  ('27673', 'Xã An Thới Đông', 'COMMUNE'),
  ('27676', 'Xã Thạnh An', 'COMMUNE');

DO $migration$
DECLARE missing text;
BEGIN
  IF (SELECT count(*) FROM dms.ward) <> 168
    OR (SELECT count(*) FROM dms.ward WHERE kind = 'WARD') <> 113
    OR (SELECT count(*) FROM dms.ward WHERE kind = 'COMMUNE') <> 54
    OR (SELECT count(*) FROM dms.ward WHERE kind = 'SPECIAL_ZONE') <> 1 THEN
    RAISE EXCEPTION 'Ward catalogue must contain 168 units (113/54/1)';
  END IF;
  -- D4 legacy mapping: one distinct representative ward per seeded former district.
  CREATE TEMPORARY TABLE legacy_district_ward (ordinal integer PRIMARY KEY,
    "districtName" text NOT NULL UNIQUE, "wardCode" text NOT NULL UNIQUE) ON COMMIT DROP;
  INSERT INTO legacy_district_ward VALUES
    ( 1, 'Quận 1', '26740'),
    ( 2, 'Quận 3', '27139'),
    ( 3, 'Quận 4', '27265'),
    ( 4, 'Quận 5', '27343'),
    ( 5, 'Quận 6', '27364'),
    ( 6, 'Quận 7', '27478'),
    ( 7, 'Quận 8', '27418'),
    ( 8, 'Quận 10', '27169'),
    ( 9, 'Quận 11', '27238'),
    (10, 'Quận 12', '26791'),
    (11, 'Bình Thạnh', '26929'),
    (12, 'Gò Vấp', '26884'),
    (13, 'Phú Nhuận', '27073'),
    (14, 'Tân Bình', '27004'),
    (15, 'Tân Phú', '27031'),
    (16, 'Bình Tân', '27442'),
    (17, 'Thủ Đức', '26824'),
    (18, 'Bình Chánh', '27637'),
    (19, 'Hóc Môn', '27559'),
    (20, 'Nhà Bè', '27655')
  ;
  SELECT string_agg(d.name, ', ' ORDER BY d.id) INTO missing FROM dms.district d
    WHERE NOT EXISTS (SELECT 1 FROM legacy_district_ward m
      JOIN dms.ward w ON w.code = m."wardCode" WHERE m."districtName" = d.name);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'No reviewed ward mapping for district(s) %', missing
      USING HINT = 'Extend legacyDistrictToWard in a reviewed revision; never guess a ward.';
  END IF;

  ALTER TABLE dms.agency ADD COLUMN "wardId" integer REFERENCES dms.ward(id) ON DELETE RESTRICT;
  -- The current guard only inspects districtId; the mapping is one-to-one, so per-ward
  -- counts equal former per-district counts. Each update is audited as a SYSTEM change
  -- under request alembic-0010-hcmc-wards. Only ", <district>, TP.HCM" is rewritten.
  UPDATE dms.agency a SET "wardId" = w.id,
    address = CASE WHEN position(', ' || d.name || ', TP.HCM' IN a.address) > 0
      THEN replace(a.address, ', ' || d.name || ', TP.HCM', ', ' || w.name || ', TP.HCM')
      ELSE a.address END
  FROM dms.district d JOIN legacy_district_ward m ON m."districtName" = d.name
  JOIN dms.ward w ON w.code = m."wardCode"
  WHERE d.id = a."districtId";
  IF EXISTS (SELECT 1 FROM dms.agency WHERE "wardId" IS NULL) THEN
    RAISE EXCEPTION 'Agency ward backfill is incomplete';
  END IF;
END $migration$;

ALTER TABLE agency ALTER COLUMN "wardId" SET NOT NULL;
DROP VIEW agency_overview;
ALTER TABLE agency DROP COLUMN "districtId";
CREATE INDEX ix_agency_ward_active ON agency ("wardId", id) WHERE status = 'ACTIVE';
CREATE INDEX ix_agency_ward ON agency ("wardId", id);

ALTER TABLE business_rule RENAME COLUMN "maxAgenciesPerDistrict" TO "maxAgenciesPerWard";
ALTER TABLE business_rule RENAME CONSTRAINT "business_rule_maxAgenciesPerDistrict_check"
  TO "business_rule_maxAgenciesPerWard_check";

-- Same locking/serialization as 0001; wards have no status, so no inactive check.
CREATE OR REPLACE FUNCTION guard_agency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  max_count integer;
  allowed_debt numeric;
BEGIN
  -- Serialize capacity checks, including moves between wards, with rule changes.
  SELECT "maxAgenciesPerWard" INTO STRICT max_count FROM dms.business_rule WHERE id FOR UPDATE;
  IF TG_OP = 'INSERT' AND NEW.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'New agency must start ACTIVE' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'TERMINATED' AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Terminated agency cannot be reopened' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' OR NEW."typeId" <> OLD."typeId" THEN
    SELECT "maxDebt" INTO STRICT allowed_debt FROM dms.agency_type
      WHERE id = NEW."typeId" AND status = 'ACTIVE' FOR SHARE;
    IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM dms.agency_balance
      WHERE "agencyId" = OLD.id AND "currentDebt" > allowed_debt) THEN
      RAISE EXCEPTION 'Debt exceeds new agency type limit' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.status = 'ACTIVE' AND (TG_OP = 'INSERT' OR NEW."wardId" <> OLD."wardId") THEN
    IF (SELECT count(*) FROM dms.agency WHERE "wardId" = NEW."wardId"
      AND status = 'ACTIVE' AND id <> NEW.id) >= max_count THEN
      RAISE EXCEPTION 'Ward agency capacity exceeded' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION guard_rules() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Business rules cannot be deleted' USING ERRCODE = '23514'; END IF;
  IF TG_TABLE_NAME = 'business_rule' THEN
    IF EXISTS (SELECT 1 FROM dms.agency WHERE status = 'ACTIVE' GROUP BY "wardId"
      HAVING count(*) > NEW."maxAgenciesPerWard") THEN
      RAISE EXCEPTION 'New ward limit is below existing active count' USING ERRCODE = '23514';
    END IF;
  ELSE
    PERFORM b."agencyId" FROM dms.agency_balance b JOIN dms.agency a ON a.id = b."agencyId"
      WHERE a."typeId" = NEW.id ORDER BY b."agencyId" FOR UPDATE OF b;
    IF EXISTS (SELECT 1 FROM dms.agency_balance b JOIN dms.agency a ON a.id = b."agencyId"
      WHERE a."typeId" = NEW.id AND b."currentDebt" > NEW."maxDebt") THEN
      RAISE EXCEPTION 'New debt limit is below existing debt' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE VIEW agency_overview AS
SELECT a.*, t.name AS "typeName", t."maxDebt", x.name AS "wardName",
  b."currentDebt", b."currentCredit", t."maxDebt" - b."currentDebt" AS "remainingCreditLimit"
FROM agency a JOIN agency_type t ON t.id = a."typeId" JOIN ward x ON x.id = a."wardId"
JOIN agency_balance b ON b."agencyId" = a.id;

-- D2 retires district.manage. Its grants are deleted (audited as SYSTEM permissions
-- changes). Historical audit_log rows reference app_function(code) ON DELETE RESTRICT and
-- stay untouched, so the function row is removed only when no audit row refers to it;
-- the application never lists, grants or authorizes a retired code.
DELETE FROM group_permission
  WHERE "functionId" IN (SELECT id FROM app_function WHERE code = 'district.manage');
DELETE FROM app_function f WHERE f.code = 'district.manage'
  AND NOT EXISTS (SELECT 1 FROM audit_log l WHERE l."functionCode" = f.code);
DROP TABLE district;
