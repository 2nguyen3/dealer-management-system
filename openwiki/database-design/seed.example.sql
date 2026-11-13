-- Optional DEMO data only. The BA specifies counts, not actual SKU names. Wards are the
-- read-only HCMC 2025 catalogue loaded by revision 0010 (hcmc_wards_2025.json), not demo data.
-- Replace these labels with approved business data before a real deployment.
-- Fresh dms schema only; fail on duplicates rather than silently changing data.
BEGIN;
SET LOCAL search_path = dms, pg_catalog;
INSERT INTO unit (code, name, "allowsFraction") VALUES
  ('PIECE', 'Cái', false), ('KG', 'Kilôgam', true), ('LITRE', 'Lít', true);
INSERT INTO product (name, "unitId", "lowStockThreshold")
SELECT 'Mặt hàng mẫu ' || n, (SELECT id FROM unit WHERE code = CASE WHEN n <= 3 THEN 'PIECE' ELSE 'KG' END), 5
FROM generate_series(1, 5) AS n;
COMMIT;
