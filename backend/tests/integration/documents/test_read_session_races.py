import time
from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.integration.documents.test_receipts import receipt
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


@pytest.mark.parametrize(
    "change,status,code",
    [("revoke", 401, "INVALID_OR_EXPIRED_TOKEN"), ("lock", 403, "ACCOUNT_LOCKED")],
)
def test_blocked_receipt_read_preserves_session_and_account_errors(
    client, engine, actor, product, change, status, code
):
    created = receipt(client, product)
    with Session(engine) as blocker, ThreadPoolExecutor(1) as pool:
        blocker.execute(
            text("SELECT id FROM dms.document WHERE id=:id FOR UPDATE"),
            {"id": int(created.json()["id"])},
        )
        future = pool.submit(client.get, created.headers["Location"])
        try:
            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as observer:
                deadline = time.monotonic() + race_timeout(5)
                while time.monotonic() < deadline:
                    if observer.scalar(
                        text(
                            "SELECT pid FROM pg_stat_activity WHERE datname=:db "
                            "AND wait_event_type='Lock' AND query LIKE '%document%'"
                        ),
                        {"db": engine.url.database},
                    ):
                        break
                    Event().wait(0.01)
                else:
                    pytest.fail("Required parent SHARE lock wait was not observed")
            with engine.begin() as connection:
                if change == "revoke":
                    connection.execute(
                        text(
                            'UPDATE dms.auth_token SET "revokedAt"=clock_timestamp() '
                            'WHERE "userId"=:id AND "revokedAt" IS NULL'
                        ),
                        {"id": actor},
                    )
                else:
                    connection.execute(
                        text("UPDATE dms.app_user SET status='LOCKED' WHERE id=:id"), {"id": actor}
                    )
        finally:
            blocker.rollback()
        response = future.result(timeout=race_timeout(15))
    assert response.status_code == status, response.text
    assert response.json()["code"] == code
    if status == 401:
        assert response.headers["WWW-Authenticate"] == "Bearer"
