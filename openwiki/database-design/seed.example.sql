-- Optional minimal example data for a fresh 0011 dms schema (standalone psql only).
-- The complete, realistic history is produced by the backend seed (python -m app.db.seed),
-- which posts documents through DocumentService; do not mix the two.
-- Wards, groups, functions, agency types and rules are created by revision 0011.
-- New products start with stock 0 and no purchase price (guard_product).
-- Fail on duplicates rather than silently changing data.
BEGIN;
SET LOCAL search_path = dms, pg_catalog;
INSERT INTO unit (code, name, "allowsFraction") VALUES
  ('BOTTLE', 'Chai', false), ('CARTON', 'Thùng', false), ('KG', 'Kg', true);
INSERT INTO product (name, "unitId") VALUES
  ('Nước mắm Nam Ngư 500ml', (SELECT id FROM unit WHERE code = 'BOTTLE')),
  ('Mì Hảo Hảo tôm chua cay thùng 30 gói', (SELECT id FROM unit WHERE code = 'CARTON')),
  ('Đường cát trắng Biên Hòa (bán theo kg)', (SELECT id FROM unit WHERE code = 'KG'));
COMMIT;
