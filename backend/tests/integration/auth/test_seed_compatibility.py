from unittest.mock import patch

import pytest
from sqlalchemy import text

from app.db.manifest import COMPATIBLE_HEAD
from app.db.seed import main
from app.db.verify import check_database, run_regression

pytestmark = pytest.mark.integration


def test_full_seed_twice_and_regression(database_factory, settings):
    with database_factory() as engine:
        with (
            patch("app.db.seed.build_engine", return_value=engine),
            patch("app.db.seed.get_settings", return_value=settings),
        ):
            main()
            with engine.connect() as connection:
                first = check_database(connection, seeded=True)
                tokens = list(
                    connection.execute(
                        text(
                            'SELECT "authVersion", purpose, "sessionId", "revokedAt" '
                            "FROM dms.auth_token"
                        )
                    )
                )
                assert len(tokens) == 16 and all(t.revokedAt is not None for t in tokens)
                assert all(
                    t.authVersion == 1 and ((t.purpose == "REFRESH") == (t.sessionId is not None))
                    for t in tokens
                )
            main()
            with engine.connect() as connection:
                assert check_database(connection, seeded=True) == first
                assert first["app_user"] == 8 and first["document"] == 410
                connection.rollback()
                transaction = connection.begin()
                try:
                    assert run_regression(connection) == 54
                finally:
                    transaction.rollback()


def test_seed_requires_new_head(database_factory, settings):
    with database_factory("0002") as engine:
        with (
            patch("app.db.seed.build_engine", return_value=engine),
            patch("app.db.seed.get_settings", return_value=settings),
            pytest.raises(RuntimeError, match=f"expected {COMPATIBLE_HEAD}"),
        ):
            main()
