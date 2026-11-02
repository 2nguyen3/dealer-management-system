from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import column, inspect, select, table, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from app.common.commands import CommandResult, CommandScope
from app.common.pagination import SortSpec, literal_search
from app.common.preconditions import canonical_etag
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.core.transactions import TransactionRunner
from app.db.seed import main as seed
from app.db.verify import check_database, run_regression
from tests.integration.shared_api.test_commands import authorize, increment
from tests.support.database import migrate, race_timeout

pytestmark = pytest.mark.integration


def test_populated_upgrade_repeat_seed_manifest_and_downgrade(database_factory):
    with database_factory("0003") as engine:
        with (
            patch("app.db.manifest.COMPATIBLE_HEAD", "0003"),
            patch("app.db.verify.INFRASTRUCTURE_TABLES", frozenset()),
            patch("app.db.seed.build_engine", return_value=engine),
        ):
            seed()
            with engine.connect() as connection:
                before = check_database(connection, seeded=True)
                hashes = connection.execute(
                    text('SELECT id,"passwordHash" FROM dms.app_user ORDER BY id')
                ).all()
                history = connection.execute(
                    text("SELECT id,code FROM dms.document ORDER BY id")
                ).all()
        migrate(engine.url)
        with patch("app.db.seed.build_engine", return_value=engine):
            seed()
            seed()
        with engine.connect() as connection:
            after = check_database(connection, seeded=True)
            assert after.pop("api_idempotency") == 0 and after == before
            assert (
                connection.execute(
                    text('SELECT id,"passwordHash" FROM dms.app_user ORDER BY id')
                ).all()
                == hashes
            )
            assert (
                connection.execute(text("SELECT id,code FROM dms.document ORDER BY id")).all()
                == history
            )
            assert run_regression(connection) == 54
            connection.rollback()
        migrate(engine.url, "0003", downgrade=True)
        assert "api_idempotency" not in inspect(engine).get_table_names(schema="dms")
        migrate(engine.url)
        with engine.begin() as connection:
            connection.exec_driver_sql("CREATE TABLE dms.unexpected (id int)")
        with (
            engine.connect() as connection,
            pytest.raises(RuntimeError, match="Unexpected DMS tables"),
        ):
            check_database(connection)
        with engine.begin() as connection:
            connection.exec_driver_sql("DROP TABLE dms.unexpected")
            connection.exec_driver_sql(
                'ALTER TABLE dms.api_idempotency ALTER COLUMN "createdAt" DROP NOT NULL'
            )
        with (
            engine.connect() as connection,
            pytest.raises(RuntimeError, match="required timestamptz"),
        ):
            check_database(connection)


def test_command_constraints_and_downgrade_blocker(database_factory):
    with database_factory() as engine:
        with engine.begin() as connection:
            actor = connection.scalar(
                text(
                    'INSERT INTO dms.app_user ("fullName",email,"passwordHash","groupId") '
                    "VALUES ('Test','test@example.com','hash',1) RETURNING id"
                )
            )
        insert = text(
            'INSERT INTO dms.api_idempotency (id,"actorId","operationId","resourceScope",'
            '"clientKey","requestDigest",state,result) VALUES '
            "(:id,:actor,'probeUpdate','probe:1',:key,:digest,'COMPLETED',CAST(:result AS jsonb))"
        )
        values = {
            "id": uuid4(),
            "actor": actor,
            "key": uuid4(),
            "digest": b"x" * 32,
            "result": '{"status":204,"body":null,"headers":{}}',
        }
        for changes in (
            {"actor": 99999},
            {"digest": b"x"},
        ):
            with pytest.raises(IntegrityError), engine.begin() as connection:
                connection.execute(insert, values | changes)
        with engine.begin() as connection:
            connection.execute(insert, values)
        with pytest.raises(IntegrityError), engine.begin() as connection:
            connection.execute(insert, values | {"id": uuid4()})
        with pytest.raises(DBAPIError):
            migrate(engine.url, "0003", downgrade=True)
        with engine.connect() as connection:
            assert (
                connection.scalar(text("SELECT version_num FROM public.alembic_version")) == "0007"
            )
            assert connection.scalar(text("SELECT count(*) FROM dms.api_idempotency")) == 1


def test_audit_context_and_parent_child_etag(engine, actor):
    with Session(engine) as session:
        with pytest.raises(ValueError):
            set_audit_context(session, actor, "x", function_code="invalid")
        set_audit_context(session, actor, "business-audit", function_code="district.manage")
        session.execute(text("INSERT INTO dms.district (code,name) VALUES ('CONTEXT','Context')"))
        session.commit()
        record = session.execute(
            text(
                'SELECT "actorId","actorType","functionCode","requestId" '
                "FROM dms.audit_log WHERE \"requestId\"='business-audit'"
            )
        ).one()
        assert tuple(record) == (actor, "USER", "district.manage", "business-audit")
        set_audit_context(session, actor, "will-clear", function_code="district.manage")
        set_audit_context(session, None, "system-audit", function_code="district.manage")
        session.execute(text("INSERT INTO dms.district (code,name) VALUES ('SYSTEM','System')"))
        session.commit()
        record = session.execute(
            text(
                'SELECT "actorId","actorType" FROM dms.audit_log WHERE "requestId"=\'system-audit\''
            )
        ).one()
        assert tuple(record) == (None, "SYSTEM")
        session.rollback()
        assert not session.scalar(text("SELECT current_setting('dms.actor_id', true)"))
        assert not session.scalar(text("SELECT current_setting('dms.request_id', true)"))
        first = canonical_etag("probe:1", {"value": 0, "children": []})
        session.execute(text("INSERT INTO dms.probe_child VALUES (1,1)"))
        session.commit()
        children = session.scalars(
            text("SELECT id FROM dms.probe_child WHERE parent=1 ORDER BY id")
        ).all()
        assert canonical_etag("probe:1", {"value": 0, "children": children}) != first


@pytest.mark.parametrize(
    "sort,expected",
    [("name", [1, 2, 3]), ("-name", [3, 2, 1]), ("id", [1, 2, 3]), ("-id", [3, 2, 1])],
)
def test_real_keyset_ties_and_literal_search(engine, sort, expected):
    probe = table("probe", column("id"), column("name"), schema="dms")
    registry = {"name": ("name", "id"), "-name": ("name", "id"), "id": ("id",), "-id": ("id",)}
    specification = SortSpec.parse(sort, registry)
    columns = {"id": probe.c.id, "name": probe.c.name}
    actual, last = [], None
    with engine.connect() as connection:
        while True:
            query = select(probe).order_by(*specification.ordering(columns)).limit(1)
            if last is not None:
                query = query.where(specification.after(columns, last))
            row = connection.execute(query).mappings().one_or_none()
            if row is None:
                break
            actual.append(row["id"])
            last = [row[name] for name in specification.fields]
        assert actual == expected
        query = select(probe).where(probe.c.name.ilike(literal_search("%_"), escape="\\"))
        assert connection.execute(query).all() == []


@pytest.mark.parametrize("isolation", ["SERIALIZABLE", "READ COMMITTED"])
def test_real_serialization_or_deadlock_retry(engine, actor, isolation):
    barrier = Barrier(2)

    def execute(identifier):
        attempts = 0
        with engine.connect().execution_options(isolation_level=isolation) as connection:
            with Session(connection) as session:

                def work(command):
                    nonlocal attempts
                    attempts += 1
                    if isolation == "SERIALIZABLE":
                        session.scalar(text("SELECT value FROM dms.probe WHERE id=1"))
                    else:
                        session.execute(
                            text("SELECT id FROM dms.probe WHERE id=:id FOR UPDATE"),
                            {"id": identifier},
                        )
                    if attempts == 1:
                        barrier.wait(timeout=race_timeout(10))
                    if isolation == "SERIALIZABLE":
                        session.execute(text("UPDATE dms.probe SET value=value+1 WHERE id=1"))
                    else:
                        session.execute(
                            text("UPDATE dms.probe SET value=value+1 WHERE id=:id"),
                            {"id": 3 - identifier},
                        )
                    return lambda: CommandResult(status=204)

                result = TransactionRunner(session).run(
                    CommandScope(actor, "probeUpdate", f"probe:{identifier}", uuid4()),
                    {},
                    authorize=lambda: None,
                    work=work,
                )
                return result, attempts

    with ThreadPoolExecutor(2) as pool:
        results = [
            future.result(timeout=race_timeout(30))
            for future in [pool.submit(execute, i) for i in (1, 2)]
        ]
    assert all(result.status == 204 for result, _ in results)
    assert sorted(attempts for _, attempts in results) == [1, 2]
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT sum(value) FROM dms.probe")) == 2
        assert connection.scalar(text("SELECT count(*) FROM dms.api_idempotency")) == 2


def test_lost_commit_reply_recovers_with_same_key(engine, actor):
    scope = CommandScope(actor, "probeUpdate", "probe:1", uuid4())
    with Session(engine) as session:
        commit = session.commit

        def lost_reply():
            commit()
            raise DBAPIError("redacted", {}, Exception("sentinel"), connection_invalidated=True)

        with patch.object(session, "commit", side_effect=lost_reply):
            with pytest.raises(ApiError, match="COMMAND_OUTCOME_UNKNOWN"):
                TransactionRunner(session).run(
                    scope,
                    {},
                    authorize=lambda: authorize(session, actor),
                    work=lambda cmd: increment(session, cmd),
                )
    with Session(engine) as session:
        recovered = TransactionRunner(session).run(
            scope,
            {},
            authorize=lambda: authorize(session, actor),
            work=lambda _: pytest.fail("duplicate effect"),
        )
        assert recovered.body == {"value": 1}
        assert session.scalar(text("SELECT value FROM dms.probe WHERE id=1")) == 1
