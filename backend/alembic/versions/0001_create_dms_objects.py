"""Create the complete reviewed DMS schema, routines, read models and core RBAC.

Revision ID: 0001
Revises: None
"""

from pathlib import Path

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # A fixed revision-local snapshot, not a mutable file outside the Docker build.
    ddl = Path(__file__).parents[1] / "sql" / "0001_initial.sql"
    op.execute(ddl.read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute("DROP SCHEMA dms CASCADE")
