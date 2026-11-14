"""Rebuild the dms schema as the simplified three-document model (2026-11-14).

Revision ID: 0011
Revises: 0010
"""

from pathlib import Path

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drops and rebuilds schema dms. Data is reseeded, not migrated (handoff D4/A5).
    ddl = Path(__file__).parents[1] / "sql" / "0011_simplified_schema.sql"
    op.execute(ddl.read_text(encoding="utf-8"))


def downgrade() -> None:
    raise RuntimeError(
        "Revision 0011 rebuilds schema dms and cannot be downgraded; "
        "restore the pre-simplification Neon backup branch instead."
    )
