"""Add durable scoped business commands.

Revision ID: 0004
Revises: 0003
"""

from pathlib import Path

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    ddl = Path(__file__).parents[1] / "sql" / "0004_api_commands.sql"
    op.execute(ddl.read_text(encoding="utf-8"))


def downgrade() -> None:
    # Never silently discard committed retry identities during a downgrade.
    op.execute("""
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM dms.api_idempotency) THEN
            RAISE EXCEPTION 'Cannot downgrade with durable commands';
          END IF;
        END $$;
        DROP TABLE dms.api_idempotency;
        DROP FUNCTION dms.guard_api_command();
    """)
