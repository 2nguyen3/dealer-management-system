"""Add authentication session lineage and immutable issuance version.

Revision ID: 0003
Revises: 0002
"""

from pathlib import Path

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    ddl = Path(__file__).parents[1] / "sql" / "0003_auth_sessions.sql"
    op.execute(ddl.read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute(
        'UPDATE dms.auth_token SET "revokedAt" = clock_timestamp() WHERE "revokedAt" IS NULL'
    )
    op.execute("DROP TRIGGER a_identity ON dms.auth_token")
    op.execute("DROP FUNCTION dms.guard_auth_token()")
    op.execute("DROP INDEX dms.uq_auth_token_live_session")
    op.execute("DROP INDEX dms.ix_auth_token_session")
    op.execute("ALTER TABLE dms.auth_token DROP CONSTRAINT ck_auth_token_session_shape")
    op.execute("ALTER TABLE dms.auth_token DROP CONSTRAINT ck_auth_token_version")
    op.execute('ALTER TABLE dms.auth_token DROP COLUMN "sessionId", DROP COLUMN "authVersion"')
