"""Serialize and preserve recorded unit fraction policy.

Revision ID: 0005
Revises: 0004
"""

from pathlib import Path

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    ddl = Path(__file__).parents[1] / "sql" / "0005_unit_policy.sql"
    op.execute(ddl.read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute("""
        DROP TRIGGER a0_fraction_policy ON dms.unit;
        DROP TRIGGER a0_unit_policy ON dms.document_line;
        DROP TRIGGER a0_unit_policy ON dms.stock_count_line;
        DROP FUNCTION dms.guard_recorded_unit_policy();
        DROP FUNCTION dms.lock_recorded_unit_policy();
    """)
