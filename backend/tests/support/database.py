import os
import re
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.engine import URL, make_url


def race_timeout(seconds: float) -> float:
    """Remote-schema races retain observed blocking, with a network-aware wait budget."""
    return seconds * 10 if os.environ.get("SUPABASE_TEST_SCHEMAS") == "1" else seconds


def guarded_test_url(raw: str | None, *, suite: str = "auth") -> URL:
    if suite not in ("auth", "business"):
        raise ValueError("Unknown database test suite")
    if not raw:
        raise RuntimeError(f"{suite.upper()}_TEST_DATABASE_URL is required for integration tests")
    url = make_url(raw)
    if url.drivername != "postgresql+psycopg" or not re.fullmatch(
        rf"agentra_{suite}_test(?:_[a-z0-9]+)?", url.database or ""
    ):
        raise RuntimeError(
            f"Integration URL must identify a disposable agentra_{suite}_test database"
        )
    if os.environ.get("DB_NAME") == url.database:
        raise RuntimeError("Test database must differ from runtime DB_NAME")
    return url


def migrate(url: URL, revision: str = "head", *, downgrade: bool = False) -> None:
    if "agentra_test_schema" in url.query:
        from tests.support.supabase import migrate_schema

        migrate_schema(url, revision, downgrade=downgrade)
        return
    backend = Path(__file__).parents[2]
    config = Config(str(backend / "alembic.ini"))
    config.set_main_option("script_location", str(backend / "alembic"))
    config.attributes["url"] = url
    (command.downgrade if downgrade else command.upgrade)(config, revision)


@contextmanager
def database_factory(base: URL):
    """Disposable databases cloned from one migrated template per revision.

    Revision 0011 drops and rebuilds the fixed ``dms`` schema, so every test gets its
    own database. Migrating 0001-0011 once and cloning keeps that cheap.
    """
    admin = create_engine(base.set(database="postgres"), isolation_level="AUTOCOMMIT")
    prefix = base.database.split("_test", 1)[0] + "_test_"
    templates: dict[str, str] = {}

    def template(revision: str) -> str:
        if revision not in templates:
            name = prefix + "tpl_" + uuid4().hex
            with admin.connect() as connection:
                connection.exec_driver_sql(f'CREATE DATABASE "{name}"')
            migrate(base.set(database=name), revision)
            templates[revision] = name
        return templates[revision]

    @contextmanager
    def create(revision="head"):
        name = prefix + uuid4().hex
        source = template(revision)
        with admin.connect() as connection:
            connection.exec_driver_sql(f'CREATE DATABASE "{name}" TEMPLATE "{source}"')
        url = base.set(database=name)
        engine = create_engine(
            url, connect_args={"options": "-c lock_timeout=5000 -c statement_timeout=15000"}
        )
        try:
            yield engine
        finally:
            engine.dispose()
            with admin.connect() as connection:
                connection.exec_driver_sql(f'DROP DATABASE "{name}" WITH (FORCE)')

    try:
        yield create
    finally:
        with admin.connect() as connection:
            for name in templates.values():
                connection.exec_driver_sql(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        admin.dispose()


@contextmanager
def selected_database_factory(*, suite="business"):
    if os.environ.get("SUPABASE_TEST_SCHEMAS") == "1":
        from tests.support.supabase import supabase_database_factory

        with supabase_database_factory() as create:
            yield create
    else:
        base = guarded_test_url(os.environ.get(f"{suite.upper()}_TEST_DATABASE_URL"), suite=suite)
        with database_factory(base) as create:
            yield create
