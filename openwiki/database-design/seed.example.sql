-- Optional DEMO data only. The BA specifies counts, not actual district/SKU names.
-- Replace these labels with approved business data before a real deployment.
-- Fresh dms schema only; fail on duplicates rather than silently changing data.
BEGIN;
SET LOCAL search_path = dms, pg_catalog;
INSERT INTO district (code, name)
SELECT 'DEMO_DISTRICT_' || n, 'Quận mẫu ' || n FROM generate_series(1, 20) AS n;
INSERT INTO unit (code, name, "allowsFraction") VALUES
  ('PIECE', 'Cái', false), ('KG', 'Kilôgam', true), ('LITRE', 'Lít', true);
INSERT INTO product (name, "unitId", "lowStockThreshold")
SELECT 'Mặt hàng mẫu ' || n, (SELECT id FROM unit WHERE code = CASE WHEN n <= 3 THEN 'PIECE' ELSE 'KG' END), 5
FROM generate_series(1, 5) AS n;
COMMIT;
