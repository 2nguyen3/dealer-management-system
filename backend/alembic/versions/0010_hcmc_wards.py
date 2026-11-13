"""Replace the abolished district level with the read-only HCMC 2025 ward catalogue.

Revision ID: 0010
Revises: 0009
"""

from pathlib import Path

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

SQL = Path(__file__).parents[1] / "sql"
# Reviewed D4 mapping (openwiki/database-design/hcmc_wards_2025.json legacyDistrictToWard),
# in the original demo order DISTRICT_01..DISTRICT_20. Kept in sync with 0010_hcmc_wards.sql.
LEGACY = (
    ("Quận 1", "26740"),
    ("Quận 3", "27139"),
    ("Quận 4", "27265"),
    ("Quận 5", "27343"),
    ("Quận 6", "27364"),
    ("Quận 7", "27478"),
    ("Quận 8", "27418"),
    ("Quận 10", "27169"),
    ("Quận 11", "27238"),
    ("Quận 12", "26791"),
    ("Bình Thạnh", "26929"),
    ("Gò Vấp", "26884"),
    ("Phú Nhuận", "27073"),
    ("Tân Bình", "27004"),
    ("Tân Phú", "27031"),
    ("Bình Tân", "27442"),
    ("Thủ Đức", "26824"),
    ("Bình Chánh", "27637"),
    ("Hóc Môn", "27559"),
    ("Nhà Bè", "27655"),
)


def upgrade() -> None:
    op.execute((SQL / "0010_hcmc_wards.sql").read_text(encoding="utf-8"))


def downgrade() -> None:
    # Lossy by design: district ids/timestamps are regenerated, every restored district is
    # ACTIVE with demo code DISTRICT_NN, district.manage grants return to the 0001 defaults
    # (MANAGEMENT only) and agency."districtId" becomes the last column. Agencies placed in
    # a ward outside the reviewed mapping block the downgrade instead of being guessed.
    original = (SQL / "0001_initial.sql").read_text(encoding="utf-8")

    def section(start: str, end: str) -> str:
        return start + original.split(start, 1)[1].split(end, 1)[0]

    values = ",\n".join(
        f"  ({index}, '{name}', '{code}')" for index, (name, code) in enumerate(LEGACY, start=1)
    )
    op.execute(f"""
SET LOCAL search_path TO dms, public;
SELECT set_config('dms.request_id', 'alembic-0010-downgrade', true);
CREATE TEMPORARY TABLE legacy_district_ward (ordinal integer PRIMARY KEY,
  "districtName" text NOT NULL UNIQUE, "wardCode" text NOT NULL UNIQUE) ON COMMIT DROP;
INSERT INTO legacy_district_ward VALUES
{values};
DO $migration$
DECLARE unmapped text;
BEGIN
  SELECT string_agg(DISTINCT w.name, ', ') INTO unmapped FROM dms.agency a
    JOIN dms.ward w ON w.id = a."wardId"
    WHERE NOT EXISTS (SELECT 1 FROM legacy_district_ward m WHERE m."wardCode" = w.code);
  IF unmapped IS NOT NULL THEN
    RAISE EXCEPTION 'Agencies use ward(s) without a former district: %', unmapped;
  END IF;
END $migration$;

INSERT INTO app_function (code, name) VALUES ('district.manage', 'Quản lý quận')
  ON CONFLICT (code) DO NOTHING;
INSERT INTO group_permission ("groupId", "functionId", "isAllowed")
  SELECT g.id, f.id, g.code = 'MANAGEMENT' FROM user_group g CROSS JOIN app_function f
  WHERE f.code = 'district.manage' ON CONFLICT ("groupId", "functionId") DO NOTHING;

{section("CREATE TABLE district (", "CREATE TABLE agency_type (")}
CREATE TRIGGER z_stamp BEFORE INSERT OR UPDATE ON district
  FOR EACH ROW EXECUTE FUNCTION stamp_row();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON district
  FOR EACH ROW EXECUTE FUNCTION audit_change('district.manage');
INSERT INTO district (code, name)
  SELECT 'DISTRICT_' || lpad(ordinal::text, 2, '0'), "districtName"
  FROM legacy_district_ward ORDER BY ordinal;

ALTER TABLE agency ADD COLUMN "districtId" integer REFERENCES district(id) ON DELETE RESTRICT;
UPDATE agency a SET "districtId" = d.id,
  address = CASE WHEN position(', ' || w.name || ', TP.HCM' IN a.address) > 0
    THEN replace(a.address, ', ' || w.name || ', TP.HCM', ', ' || d.name || ', TP.HCM')
    ELSE a.address END
FROM ward w JOIN legacy_district_ward m ON m."wardCode" = w.code
JOIN district d ON d.name = m."districtName"
WHERE w.id = a."wardId";
ALTER TABLE agency ALTER COLUMN "districtId" SET NOT NULL;
DROP VIEW agency_overview;
ALTER TABLE agency DROP COLUMN "wardId";
CREATE INDEX ix_agency_district_active ON agency ("districtId", id) WHERE status = 'ACTIVE';
CREATE INDEX ix_agency_district ON agency ("districtId", id);

ALTER TABLE business_rule RENAME COLUMN "maxAgenciesPerWard" TO "maxAgenciesPerDistrict";
ALTER TABLE business_rule RENAME CONSTRAINT "business_rule_maxAgenciesPerWard_check"
  TO "business_rule_maxAgenciesPerDistrict_check";
CREATE OR REPLACE {
        section("FUNCTION guard_agency()", "CREATE FUNCTION guard_rules()")
    }CREATE OR REPLACE {section("FUNCTION guard_rules()", "CREATE FUNCTION guard_unit_product()")}
{section("CREATE VIEW agency_overview AS", "CREATE VIEW inventory_overview AS")}
DROP TABLE ward;
""")
