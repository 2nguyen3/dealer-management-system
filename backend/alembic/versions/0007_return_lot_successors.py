"""Preserve original credit lots across sales-return rounding successors.

Revision ID: 0007
Revises: 0006
"""

from pathlib import Path

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        (Path(__file__).parents[1] / "sql" / "0007_return_lot_successors.sql").read_text(
            encoding="utf-8"
        )
    )


def downgrade() -> None:
    # Restoring the stricter guard changes future writes only; no evidence is removed.
    op.execute("""
    DO $migration$
    DECLARE definition text; start_at integer; end_at integer;
    BEGIN
      SELECT pg_get_functiondef('dms.guard_ledger()'::regprocedure) INTO definition;
      start_at := position('WHERE id = NEW."lotId" AND ("sourceRevisionId"' IN definition);
      end_at := position(E' THEN\n      RAISE EXCEPTION ''Created credit' IN definition);
      IF start_at = 0 OR end_at <= start_at THEN
        RAISE EXCEPTION 'Unexpected successor guard; review before downgrade';
      END IF;
      EXECUTE substring(definition FROM 1 FOR start_at - 1)
        || 'WHERE id = NEW."lotId" AND "sourceRevisionId" = source_revision.id)'
        || substring(definition FROM end_at);
    END $migration$;
    """)
