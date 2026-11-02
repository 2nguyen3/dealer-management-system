import pytest
from sqlalchemy import text

from app.core.config import Settings
from app.db.session import build_engine
from tests.support.database import migrate

pytestmark = pytest.mark.integration


def test_schema_head_roundtrip_and_independent_connections_leave_runtime_untouched(
    database_factory,
):
    runtime = build_engine(Settings().database_url())
    with runtime.connect() as c:
        before = c.execute(
            text(
                "SELECT version_num,(SELECT count(*) FROM dms.document) FROM public.alembic_version"
            )
        ).one()
    with database_factory("0002") as engine:
        with engine.connect() as connection:
            assert (
                connection.scalar(text("SELECT version_num FROM public.alembic_version")) == "0002"
            )
        migrate(engine.url)
        with engine.begin() as connection:
            assert (
                connection.scalar(text("SELECT version_num FROM public.alembic_version")) == "0007"
            )
            connection.execute(
                text("INSERT INTO dms.district (code,name) VALUES ('ISOLATED','Test')")
            )
        with engine.connect() as other:
            assert other.scalar(text("SELECT count(*) FROM dms.district")) == 1
            assert other.scalar(text("SELECT count(*) FROM dms.api_idempotency")) == 0
        migrate(engine.url, "0002", downgrade=True)
        migrate(engine.url)
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM dms.district")) == 1
        migrate(engine.url, "base", downgrade=True)
        migrate(engine.url)
        with engine.connect() as c:
            assert c.scalar(text("SELECT count(*) FROM dms.district")) == 0
        with pytest.raises(TypeError), engine.connect() as c:
            c.connection.driver_connection.execute(b"SELECT * FROM dms.document")
    with runtime.connect() as c:
        assert (
            c.execute(
                text(
                    "SELECT version_num,(SELECT count(*) FROM dms.document) "
                    "FROM public.alembic_version"
                )
            ).one()
            == before
        )
    runtime.dispose()
