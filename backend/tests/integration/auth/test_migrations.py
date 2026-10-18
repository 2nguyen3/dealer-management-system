from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from app.db.base import Base, include_name
from app.db.manifest import INFRASTRUCTURE_TABLES
from app.modules.auth.models import AppFunction, AuthToken, GroupPermission
from app.modules.user_groups.models import UserGroup
from app.modules.users.models import AppUser
from tests.support.database import migrate

pytestmark = pytest.mark.integration


def test_populated_upgrade_downgrade_reupgrade(database_factory):
    with database_factory("0002") as engine:
        with engine.begin() as connection:
            user = connection.scalar(
                text(
                    'INSERT INTO dms.app_user ("fullName", email, "passwordHash", "groupId") '
                    "VALUES ('Test', 'test@example.com', 'hash-unchanged', 1) RETURNING id"
                )
            )
            for purpose in ("REFRESH", "PASSWORD_RESET"):
                connection.execute(
                    text(
                        'INSERT INTO dms.auth_token ("userId", purpose, '
                        '"tokenDigest", "expiresAt") '
                        "VALUES (:user, :purpose, :digest, clock_timestamp()+interval '1 day')"
                    ),
                    {"user": user, "purpose": purpose, "digest": (purpose * 32).encode()[:32]},
                )
            previous_revocation = connection.scalar(
                text(
                    'UPDATE dms.auth_token SET "revokedAt"=clock_timestamp() '
                    "WHERE purpose='PASSWORD_RESET' RETURNING \"revokedAt\""
                )
            )
            connection.execute(
                text("INSERT INTO dms.district (code,name) VALUES ('LEGACY','Legacy district')")
            )
            connection.execute(
                text("INSERT INTO dms.unit (code,name) VALUES ('LEGACY','Legacy unit')")
            )
            connection.execute(
                text(
                    'INSERT INTO dms.product (name,"unitId") '
                    "SELECT 'Legacy product',id FROM dms.unit WHERE code='LEGACY'"
                )
            )
        migrate(engine.url)
        with engine.connect() as connection:
            tokens = list(
                connection.execute(
                    text(
                        'SELECT purpose, "authVersion", "sessionId", "revokedAt" '
                        "FROM dms.auth_token"
                    )
                )
            )
            assert all(t.authVersion == 1 and t.revokedAt is not None for t in tokens)
            assert all((t.purpose == "REFRESH") == (t.sessionId is not None) for t in tokens)
            assert (
                next(t.revokedAt for t in tokens if t.purpose == "PASSWORD_RESET")
                == previous_revocation
            )
            assert connection.scalar(text("SELECT name FROM dms.product")) == "Legacy product"
            assert connection.scalar(text('SELECT "currentStock" FROM dms.inventory_balance')) == 0
            assert (
                connection.scalar(text('SELECT "passwordHash" FROM dms.app_user'))
                == "hash-unchanged"
            )
            assert len(inspect(connection).get_table_names(schema="dms")) == 29 + len(
                INFRASTRUCTURE_TABLES
            )
        migrate(engine.url, "0002", downgrade=True)
        with engine.connect() as connection:
            assert "sessionId" not in {
                c["name"] for c in inspect(connection).get_columns("auth_token", schema="dms")
            }
        migrate(engine.url)
        migrate(engine.url)


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
        "dms.api_idempotency",
        "dms.district",
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
