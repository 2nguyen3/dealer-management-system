from unittest.mock import patch

import pytest
from sqlalchemy import text

from app.db import seed_data
from app.db.manifest import COMPATIBLE_HEAD
from app.db.seed import SeedError, main
from app.db.verify import check_database, run_regression

pytestmark = pytest.mark.integration

FINGERPRINT = text(
    "SELECT (SELECT count(*) FROM dms.audit_log), "
    '(SELECT max("updatedAt") FROM dms.document), '
    "(SELECT sum(debt) FROM dms.agency), (SELECT sum(stock) FROM dms.product), "
    "(SELECT string_agg(\"passwordHash\", ',' ORDER BY id) FROM dms.app_user)"
)


def patched(engine, settings):
    return (
        patch("app.db.seed.build_engine", return_value=engine),
        patch("app.db.seed.get_settings", return_value=settings),
    )


def test_seed_v2_then_rerun_only_verifies(database_factory, settings, capsys):
    with database_factory() as engine:
        build, config = patched(engine, settings)
        with build, config:
            main()
            assert "PASS: seed v2 committed and verified" in capsys.readouterr().out
            with engine.connect() as connection:
                first = check_database(connection, seeded=True)
                before = connection.execute(FINGERPRINT).one()
                emails = set(connection.execute(text("SELECT email FROM dms.app_user")).scalars())
                assert connection.scalar(text("SELECT count(*) FROM dms.auth_token")) == 0
            assert first["app_user"] == len(seed_data.USERS) == 11
            assert emails == {user[0] for user in seed_data.USERS}
            assert first["ward"] == 168 and first["app_function"] == 22
            assert first["agency"] == len(seed_data.AGENCIES) and first["document"] >= 420

            main()
            output = capsys.readouterr().out
            assert "already present; verification only" in output
            assert "PASS: seed v2 committed" not in output
            with engine.connect() as connection:
                assert check_database(connection, seeded=True) == first
                assert connection.execute(FINGERPRINT).one() == before
                connection.rollback()
                transaction = connection.begin()
                try:
                    assert run_regression(connection) == 83
                finally:
                    transaction.rollback()


def test_seed_requires_current_head(database_factory, settings):
    with database_factory("0010") as engine:
        build, config = patched(engine, settings)
        with build, config, pytest.raises(SeedError, match=f"expected {COMPATIBLE_HEAD}"):
            main()
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM dms.app_user")) == 0


def test_seed_refuses_partially_populated_schema(database_factory, settings):
    with database_factory() as engine:
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO dms.unit (code, name) VALUES ('CAI', 'Cái')"))
        build, config = patched(engine, settings)
        with build, config, pytest.raises(SeedError, match="empty migrated 0011"):
            main()
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM dms.agency")) == 0
            assert connection.scalar(text("SELECT count(*) FROM dms.unit")) == 1
