"""Preserve historical issue admission after master/agency retirement.

Revision ID: 0009
Revises: 0008
"""

from pathlib import Path

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        (Path(__file__).parents[1] / "sql" / "0009_historical_issue_corrections.sql").read_text(
            encoding="utf-8"
        )
    )


def downgrade() -> None:
    # Restore the reviewed initial guard, then reapply predecessor receipt policy.
    original = (Path(__file__).parents[1] / "sql" / "0001_initial.sql").read_text(encoding="utf-8")
    guard = original.split("CREATE FUNCTION guard_revision()", 1)[1].split(
        "CREATE FUNCTION guard_line()", 1
    )[0]
    op.execute("CREATE OR REPLACE FUNCTION dms.guard_revision()" + guard)
    op.execute(
        (Path(__file__).parents[1] / "sql" / "0008_historical_receipt_corrections.sql").read_text(
            encoding="utf-8"
        )
    )
