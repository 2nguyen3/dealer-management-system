from unittest.mock import patch

import pytest
from sqlalchemy import text

from app.core.config import Settings
from app.db.seed import main as seed_main
from app.db.verify import check_database, run_regression
from tests.support.database import migrate

pytestmark = pytest.mark.integration


def test_populated_0006_successor_guard_upgrade_seed_and_downgrade(database_factory):
    settings = Settings(_env_file=None, db_host="test", db_user="test", db_password="test")
    with database_factory("0006") as engine:
        with (
            patch("app.db.manifest.COMPATIBLE_HEAD", "0006"),
            patch("app.db.seed.build_engine", return_value=engine),
            patch("app.db.seed.get_settings", return_value=settings),
        ):
            seed_main()
        with engine.connect() as connection:
            snapshots = connection.execute(
                text("SELECT id,to_jsonb(r) FROM dms.document_revision r ORDER BY id")
            ).all()
            lots = connection.execute(
                text("SELECT id,to_jsonb(l) FROM dms.credit_lot l ORDER BY id")
            ).all()
        migrate(engine.url)
        with (
            patch("app.db.seed.build_engine", return_value=engine),
            patch("app.db.seed.get_settings", return_value=settings),
        ):
            seed_main()
            seed_main()
        with engine.connect() as connection:
            assert check_database(connection, seeded=True)["document"] == 410
            assert (
                connection.execute(
                    text("SELECT id,to_jsonb(r) FROM dms.document_revision r ORDER BY id")
                ).all()
                == snapshots
            )
            assert (
                connection.execute(
                    text("SELECT id,to_jsonb(l) FROM dms.credit_lot l ORDER BY id")
                ).all()
                == lots
            )
            connection.rollback()
            with connection.begin() as transaction:
                assert run_regression(connection) == 54
                transaction.rollback()
        migrate(engine.url, "0006", downgrade=True)
        migrate(engine.url)
        with engine.connect() as connection:
            assert (
                connection.scalar(text("SELECT version_num FROM public.alembic_version")) == "0007"
            )
