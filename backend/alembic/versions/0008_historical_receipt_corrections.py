"""Allow recorded receipt goods in historical correction successors.

Revision ID: 0008
Revises: 0007
"""

from pathlib import Path

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        (Path(__file__).parents[1] / "sql" / "0008_historical_receipt_corrections.sql").read_text(
            encoding="utf-8"
        )
    )


def downgrade() -> None:
    original = (Path(__file__).parents[1] / "sql" / "0001_initial.sql").read_text(encoding="utf-8")
    guard = original.split("CREATE FUNCTION guard_revision()", 1)[1].split(
        "CREATE FUNCTION guard_line()", 1
    )[0]
    op.execute("CREATE OR REPLACE FUNCTION dms.guard_revision()" + guard)
