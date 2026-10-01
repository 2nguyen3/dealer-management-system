"""Add pg_trgm substring search indexes without assuming its extension schema.

Revision ID: 0002
Revises: 0001
"""

from pathlib import Path

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    ddl = Path(__file__).parents[1] / "sql" / "0002_search_indexes.sql"
    op.execute(ddl.read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute("DROP INDEX dms.ix_product_name_contains")
    op.execute("DROP INDEX dms.ix_agency_name_contains")
    # pg_trgm may be shared with other Supabase schemas; retain the extension.
