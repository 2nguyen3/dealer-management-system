"""Explicit, disposable schema isolation on the configured Supabase PostgreSQL server."""

import re
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

import psycopg
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine

from app.core.config import Settings


def validate_schema(schema):
    if not re.fullmatch(r"agentra_test_[0-9a-f]{32}", schema):
        raise ValueError("Only generated isolated test schemas are permitted")
    return schema


def rewrite_sql(sql, schema):
    validate_schema(schema)
    if not isinstance(sql, str):
        raise TypeError("Isolated test SQL must be text")
    rewritten = re.sub(r"\bdms\b", schema, sql, flags=re.IGNORECASE)
    return re.sub(
        r"\bpublic\.alembic_version\b",
        f"{schema}_meta.alembic_version",
        rewritten,
        flags=re.IGNORECASE,
    )


def schema_engine(url, schema):
    validate_schema(schema)

    class IsolatedCursor(psycopg.Cursor):
        def execute(self, query, params=None, *, prepare=None, binary=None):
            query = rewrite_sql(query, schema)
            catalog_query = any(
                name in query for name in ("pg_catalog.", "information_schema.", "pg_tables")
            )
            if catalog_query and isinstance(params, dict):
                params = {key: schema if value == "dms" else value for key, value in params.items()}
            elif catalog_query and isinstance(params, (tuple, list)):
                params = tuple(schema if value == "dms" else value for value in params)
            return super().execute(query, params, prepare=prepare, binary=binary)

        def executemany(self, query, params_seq, *, returning=False):
            query = rewrite_sql(query, schema)
            return super().executemany(query, params_seq, returning=returning)

        def logical_row(self, row):
            # Catalog reflection must see the logical schema used by ORM metadata.
            # Domain business rows are never rewritten on the return path.
            if row is None or not self.description:
                return row
            schema_columns = {"nspname", "schema", "schema_name", "referred_schema"}
            definition_columns = {"format_type", "condef", "consrc", "attype", "anon_1"}
            values = list(row)
            for index, description in enumerate(self.description):
                if description.name in schema_columns and values[index] == schema:
                    values[index] = "dms"
                elif description.name in definition_columns and isinstance(values[index], str):
                    values[index] = values[index].replace(schema + ".", "dms.")
            return tuple(values)

        def fetchone(self):
            return self.logical_row(super().fetchone())

        def fetchmany(self, size=0):
            return [self.logical_row(row) for row in super().fetchmany(size)]

        def fetchall(self):
            return [self.logical_row(row) for row in super().fetchall()]

    def connect():
        return psycopg.connect(
            host=url.host,
            port=url.port,
            dbname=url.database,
            user=url.username,
            password=url.password,
            sslmode=url.query.get("sslmode", "require"),
            connect_timeout=5,
            prepare_threshold=None,
            cursor_factory=IsolatedCursor,
            options=(
                f"-c search_path={schema}_meta,pg_catalog "
                "-c lock_timeout=120000 -c statement_timeout=180000"
            ),
        )

    marked = url.update_query_dict({"agentra_test_schema": schema})
    return create_engine(marked, creator=connect, pool_size=5, max_overflow=5, pool_pre_ping=True)


def migrate_schema(url, revision="head", *, downgrade=False):
    # Match Alembic env.py's explicitly registered ORM metadata for drift tests.
    from app.common import commands  # noqa: F401
    from app.modules.agency_types import models as agency_types  # noqa: F401
    from app.modules.auth import models as auth  # noqa: F401
    from app.modules.districts import models as districts  # noqa: F401
    from app.modules.units import models as units  # noqa: F401
    from app.modules.user_groups import models as user_groups  # noqa: F401
    from app.modules.users import models as users  # noqa: F401

    schema = validate_schema(url.query["agentra_test_schema"])
    engine = schema_engine(url, schema)
    config = Config(str(Path(__file__).parents[2] / "alembic.ini"))
    config.set_main_option("script_location", str(Path(__file__).parents[2] / "alembic"))
    scripts = ScriptDirectory.from_config(config)
    try:
        with engine.begin() as connection:
            connection.exec_driver_sql(f"CREATE SCHEMA IF NOT EXISTS {schema}_meta")
            exists = connection.exec_driver_sql(
                f"SELECT to_regclass('{schema}_meta.alembic_version')"
            ).scalar_one()
            current = (
                connection.exec_driver_sql(
                    f"SELECT version_num FROM {schema}_meta.alembic_version"
                ).scalar()
                if exists
                else None
            )
            target = scripts.get_revision(revision).revision if revision != "base" else None
            context = MigrationContext.configure(connection)
            with Operations.context(context):
                if downgrade:
                    steps = scripts.iterate_revisions(current, target)
                    for step in steps:
                        step.module.downgrade()
                else:
                    steps = reversed(list(scripts.iterate_revisions(target, current)))
                    for step in steps:
                        step.module.upgrade()
            if target is not None:
                connection.exec_driver_sql(
                    f"CREATE TABLE IF NOT EXISTS {schema}_meta.alembic_version "
                    "(version_num varchar(32) PRIMARY KEY)"
                )
                connection.exec_driver_sql(f"DELETE FROM {schema}_meta.alembic_version")
                connection.exec_driver_sql(
                    f"INSERT INTO {schema}_meta.alembic_version VALUES (%s)", (target,)
                )
            elif exists:
                connection.exec_driver_sql(f"DELETE FROM {schema}_meta.alembic_version")
    finally:
        engine.dispose()


@contextmanager
def supabase_database_factory():
    settings = Settings()
    if not settings.db_host.lower().endswith((".supabase.com", ".supabase.co")):
        raise RuntimeError("Supabase schema tests require an explicitly configured Supabase host")
    base = settings.database_url()

    @contextmanager
    def create(revision="head"):
        schema = "agentra_test_" + uuid4().hex
        engine = schema_engine(base, schema)
        try:
            migrate_schema(engine.url, revision)
            yield engine
        finally:
            with engine.begin() as connection:
                connection.exec_driver_sql(
                    f"DROP SCHEMA IF EXISTS {validate_schema(schema)} CASCADE"
                )
                connection.exec_driver_sql(f"DROP SCHEMA IF EXISTS {schema}_meta CASCADE")
            engine.dispose()

    yield create
