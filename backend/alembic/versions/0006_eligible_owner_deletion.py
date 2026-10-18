"""Eligible zero-cache owner deletion and recorded product policy.

Revision ID: 0006
Revises: 0005
"""

from pathlib import Path

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        (Path(__file__).parents[1] / "sql" / "0006_eligible_owner_deletion.sql").read_text(
            encoding="utf-8"
        )
    )


def downgrade() -> None:
    op.execute("""
        DROP TRIGGER a0_eligible_delete ON dms.product;
        DROP TRIGGER a0_agency_history ON dms.document_revision;
        DROP FUNCTION dms.lock_document_agency_history();
        DROP TRIGGER a0_history_date ON dms.agency;
        DROP FUNCTION dms.guard_agency_history_date();
        DROP TRIGGER a0_eligible_delete ON dms.agency;
        DROP FUNCTION dms.guard_eligible_owner_deletion();
        DROP TRIGGER a0_product_policy ON dms.document_line;
        DROP TRIGGER a0_product_policy ON dms.stock_count_line;
        DROP FUNCTION dms.lock_recorded_product_policy();
        DROP TRIGGER a0_recorded_policy ON dms.product;
        DROP FUNCTION dms.guard_recorded_product_policy();
        ALTER TABLE dms.inventory_balance DROP CONSTRAINT "inventory_balance_productId_fkey";
        ALTER TABLE dms.inventory_balance ADD CONSTRAINT "inventory_balance_productId_fkey"
          FOREIGN KEY ("productId") REFERENCES dms.product(id) ON DELETE RESTRICT;
        ALTER TABLE dms.agency_balance DROP CONSTRAINT "agency_balance_agencyId_fkey";
        ALTER TABLE dms.agency_balance ADD CONSTRAINT "agency_balance_agencyId_fkey"
          FOREIGN KEY ("agencyId") REFERENCES dms.agency(id) ON DELETE RESTRICT;
        CREATE OR REPLACE FUNCTION dms.protect_balance() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF TG_OP = 'DELETE' OR pg_trigger_depth() < 2 THEN
            RAISE EXCEPTION 'Balance caches are maintained by deferred ledger checks'
              USING ERRCODE='23514';
          END IF;
          RETURN NEW;
        END $$;
    """)
