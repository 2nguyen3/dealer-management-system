from types import SimpleNamespace
from unittest.mock import patch

import pytest
from sqlalchemy import text

from app.db.manifest import COMPATIBLE_HEAD
from app.db.seed import main as seed_demo
from app.db.verify import check_database, run_regression
from tests.integration.document_corrections.helpers import snapshot
from tests.support.database import migrate

pytestmark = pytest.mark.integration


def test_0008_populated_demo_upgrade_seed_twice_and_54_regressions(database_factory):
    with database_factory("0007") as engine:
        with (
            patch("app.db.seed.build_engine", return_value=engine),
            patch(
                "app.db.seed.get_settings",
                return_value=SimpleNamespace(database_url=lambda: engine.url),
            ),
        ):
            # Build the reviewed predecessor fixture at its original compatible head.
            with patch("app.db.manifest.COMPATIBLE_HEAD", "0007"):
                seed_demo()
            before = snapshot(engine)
            migrate(engine.url, "head")
            assert snapshot(engine) == before
            seed_demo()
            seed_demo()
            assert snapshot(engine) == before
        with engine.connect() as connection:
            assert (
                connection.scalar(text("SELECT version_num FROM public.alembic_version"))
                == COMPATIBLE_HEAD
            )
            counts = check_database(connection, seeded=True)
            assert counts["document"] == 410 and counts["product"] == 24 and counts["agency"] == 30
            connection.rollback()
            assert run_regression(connection) == 54
            connection.rollback()
        assert snapshot(engine) == before
