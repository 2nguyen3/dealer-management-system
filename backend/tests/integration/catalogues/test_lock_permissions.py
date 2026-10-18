import time
from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.integration.catalogues.conftest import CASES
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("stale_target", [False, True])
def test_revoked_grant_during_real_target_lock_wait(client, engine, resource, stale_target):
    created = client.post("/api/v1/" + resource, json=CASES[resource][2])
    identifier = created.json()["id"]
    path = created.headers["Location"]
    table = CASES[resource][0].repository.model.__tablename__
    with Session(engine) as blocker:
        blocker.execute(
            text(f"SELECT id FROM dms.{table} WHERE id=:id FOR UPDATE"), {"id": int(identifier)}
        )
        with ThreadPoolExecutor(1) as pool:
            pending = pool.submit(
                client.patch,
                path,
                json={"fullName" if resource == "users" else "name": "Denied"},
                headers={"If-Match": created.headers["ETag"]},
            )
            try:
                deadline = time.monotonic() + race_timeout(5)
                with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as observer:
                    while time.monotonic() < deadline:
                        pid = observer.scalar(
                            text(
                                "SELECT pid FROM pg_stat_activity WHERE datname=:db "
                                "AND wait_event_type='Lock' AND query LIKE :pattern"
                            ),
                            {"db": engine.url.database, "pattern": "%" + table + "%"},
                        )
                        if pid:
                            break
                        Event().wait(0.01)
                    else:
                        pytest.fail("Expected HTTP target lock wait")
                with engine.begin() as connection:
                    connection.execute(
                        text(
                            'UPDATE dms.group_permission SET "isAllowed"=false '
                            'WHERE "groupId"=1 AND "functionId"='
                            "(SELECT id FROM dms.app_function WHERE code=:code)"
                        ),
                        {"code": CASES[resource][0].permission},
                    )
            finally:
                if stale_target:
                    column = "fullName" if resource == "users" else "name"
                    blocker.execute(
                        text(f"UPDATE dms.{table} SET \"{column}\"='External' WHERE id=:id"),
                        {"id": int(identifier)},
                    )
                    blocker.commit()
                else:
                    blocker.rollback()
            response = pending.result(timeout=race_timeout(15))
    assert response.status_code == 403
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text('SELECT count(*) FROM dms.audit_log WHERE "requestId"=:id'),
                {"id": response.headers["X-Request-Id"]},
            )
            == 0
        )
        assert connection.scalar(
            text(
                f'SELECT "{"fullName" if resource == "users" else "name"}" '
                f"FROM dms.{table} WHERE id=:id"
            ),
            {"id": int(identifier)},
        ) == ("External" if stale_target else "New")
