from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from app.db.base import Base, include_name
from app.modules.auth.models import AppFunction, AuthToken, GroupPermission
from app.modules.user_groups.models import UserGroup
from app.modules.users.models import AppUser
from tests.support.database import migrate

pytestmark = pytest.mark.integration


SIMPLIFIED_TABLES = {
    "user_group",
    "app_function",
    "app_user",
    "group_permission",
    "auth_token",
    "business_rule",
    "ward",
    "agency_type",
    "unit",
    "agency",
    "product",
    "document",
    "document_line",
    "online_payment",
    "payment_event",
    "audit_log",
}


def schema_shape(connection):
    inspector = inspect(connection)
    return {
        table: sorted(column["name"] for column in inspector.get_columns(table, schema="dms"))
        for table in inspector.get_table_names(schema="dms")
    }


def test_populated_0010_rebuilds_to_fresh_0011_schema(database_factory):
    with database_factory() as fresh, fresh.connect() as connection:
        expected = schema_shape(connection)
    assert set(expected) == SIMPLIFIED_TABLES
    with database_factory("0010") as engine:
        with engine.begin() as connection:
            user = connection.scalar(
                text(
                    'INSERT INTO dms.app_user ("fullName", email, "passwordHash", "groupId") '
                    "VALUES ('Legacy', 'legacy@example.com', 'hash', 1) RETURNING id"
                )
            )
            connection.execute(
                text(
                    'INSERT INTO dms.auth_token ("userId", purpose, "tokenDigest", "authVersion",'
                    ' "sessionId", "expiresAt") VALUES (:user, \'REFRESH\', :digest, 1, '
                    ":sid, clock_timestamp() + interval '1 day')"
                ),
                {"user": user, "digest": b"r" * 32, "sid": uuid4()},
            )
            connection.execute(text("INSERT INTO dms.unit (code,name) VALUES ('OLD','Old unit')"))
            assert connection.scalar(
                text("SELECT count(*) FROM pg_tables WHERE tablename = 'inventory_balance'")
            )
        migrate(engine.url)
        with engine.connect() as connection:
            assert schema_shape(connection) == expected
            assert connection.scalar(text("SELECT version_num FROM public.alembic_version")) == (
                "0011"
            )
            for table in ("app_user", "auth_token", "unit", "agency", "product", "document"):
                assert connection.scalar(text(f"SELECT count(*) FROM dms.{table}")) == 0
            assert connection.scalar(text("SELECT count(*) FROM dms.ward")) == 168
            assert set(connection.scalars(text("SELECT code FROM dms.user_group"))) == {
                "MANAGEMENT",
                "SALES",
                "WAREHOUSE",
                "ACCOUNTING",
            }
            assert connection.scalar(text("SELECT count(*) FROM dms.app_function")) == 22
            assert connection.scalar(text("SELECT count(*) FROM dms.group_permission")) == 88
            assert not connection.scalar(
                text(
                    "SELECT count(*) FROM dms.app_function WHERE code IN "
                    "('inventory.read','cash.upfront.verify','stock.count','credit.apply',"
                    "'district.manage') OR code LIKE 'returns.%' OR code LIKE 'cash.refund.%' "
                    "OR code LIKE 'stock.adjustment.%'"
                )
            )
        with pytest.raises(RuntimeError, match="cannot be downgraded"):
            migrate(engine.url, "0010", downgrade=True)
        migrate(engine.url)
        with engine.connect() as connection:
            assert schema_shape(connection) == expected


@pytest.mark.parametrize(
    "column,value",
    [
        ("userId", "999999"),
        ("purpose", "'PASSWORD_RESET'"),
        ("tokenDigest", "decode(repeat('ff',32),'hex')"),
        ("authVersion", "2"),
        ("sessionId", "gen_random_uuid()"),
        ("expiresAt", "clock_timestamp()+interval '2 days'"),
    ],
)
def test_token_identity_guard(engine, user, column, value):
    with engine.begin() as connection:
        identifier = connection.scalar(
            text(
                'INSERT INTO dms.auth_token ("userId",purpose,"tokenDigest","authVersion",'
                '"sessionId","expiresAt") VALUES (:user,\'REFRESH\',:digest,1,:sid,'
                "clock_timestamp()+interval '1 day') RETURNING id"
            ),
            {"user": user, "digest": b"x" * 32, "sid": uuid4()},
        )
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.exec_driver_sql(
            f'UPDATE dms.auth_token SET "{column}"={value} WHERE id={identifier}'
        )


def test_revocation_irreversible_and_constraints(engine, user):
    sid = uuid4()
    insert = text(
        'INSERT INTO dms.auth_token ("userId",purpose,"tokenDigest","authVersion",'
        '"sessionId","expiresAt") VALUES (:user,:purpose,:digest,:ver,:sid,:expiry) RETURNING id'
    )
    valid = {
        "user": user,
        "purpose": "REFRESH",
        "digest": b"v" * 32,
        "ver": 1,
        "sid": sid,
        "expiry": datetime.now(UTC) + timedelta(days=1),
    }
    with engine.begin() as connection:
        identifier = connection.scalar(insert, valid)
    for overrides in (
        {"digest": b"short"},
        {"digest": b"w" * 32},
        {"ver": 0, "digest": b"y" * 32},
        {"sid": None, "digest": b"y" * 32},
        {"purpose": "PASSWORD_RESET", "digest": b"y" * 32},
        {"expiry": datetime.now(UTC) - timedelta(days=1), "digest": b"y" * 32},
    ):
        with pytest.raises(IntegrityError), engine.begin() as connection:
            connection.execute(insert, valid | overrides)
    with engine.begin() as connection:
        connection.execute(
            text('UPDATE dms.auth_token SET "revokedAt"=clock_timestamp() WHERE id=:id'),
            {"id": identifier},
        )
    for value in ("NULL", "clock_timestamp()"):
        with pytest.raises(IntegrityError), engine.begin() as connection:
            connection.exec_driver_sql(
                f'UPDATE dms.auth_token SET "revokedAt"={value} WHERE id={identifier}'
            )


def test_orm_mappings(engine):
    assert {
        model.__table__.schema
        for model in (AppUser, UserGroup, AppFunction, AuthToken, GroupPermission)
    } == {"dms"}
    assert set(Base.metadata.tables) == {
        "dms.app_user",
        "dms.user_group",
        "dms.app_function",
        "dms.group_permission",
        "dms.auth_token",
        "dms.ward",
        "dms.agency_type",
        "dms.unit",
    }
    with engine.connect() as connection:
        inspector = inspect(connection)
        for table in Base.metadata.sorted_tables:
            assert set(table.columns.keys()) <= {
                column["name"] for column in inspector.get_columns(table.name, schema="dms")
            }
        context = MigrationContext.configure(
            connection,
            opts={
                "include_schemas": True,
                "include_name": include_name,
                "compare_type": True,
            },
        )
        assert compare_metadata(context, Base.metadata) == []
