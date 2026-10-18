import time
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.integration.documents.test_receipts import receipt
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("action", ["create", "update", "post"])
def test_receipt_permissions_are_rechecked_after_real_lock_wait(client, engine, product, action):
    created = receipt(client, product)
    permission = "stock.receipt.post" if action == "post" else "stock.receipt.prepare"
    if action == "create":
        path, method = "/api/v1/stock-receipts", "POST"
        body = {
            "businessDate": "2026-10-02",
            "lines": [{"productId": product["id"], "quantity": "1", "unitPrice": "100"}],
        }
    else:
        path = created.headers["Location"] + ("/post" if action == "post" else "")
        method = "POST" if action == "post" else "PATCH"
        body = None if action == "post" else {"note": "Denied"}
    table = "document" if action == "update" else "product"
    identifier = int(created.json()["id"]) if table == "document" else int(product["id"])
    with Session(engine) as blocker, ThreadPoolExecutor(1) as pool:
        blocker.execute(
            text(f"SELECT id FROM dms.{table} WHERE id=:id FOR UPDATE"), {"id": identifier}
        )
        future = pool.submit(
            client.request,
            method,
            path,
            json=body,
            headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
        )
        try:
            deadline = time.monotonic() + race_timeout(5)
            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as observer:
                while time.monotonic() < deadline:
                    waiting = observer.scalar(
                        text(
                            "SELECT pid FROM pg_stat_activity WHERE datname=:db "
                            "AND wait_event_type='Lock' AND query LIKE :query"
                        ),
                        {"db": engine.url.database, "query": "%" + table + "%"},
                    )
                    if waiting:
                        break
                    Event().wait(0.01)
                else:
                    pytest.fail("Required real PostgreSQL lock wait was not observed")
            with engine.begin() as connection:
                connection.execute(
                    text(
                        'UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1 '
                        'AND "functionId"=(SELECT id FROM dms.app_function WHERE code=:code)'
                    ),
                    {"code": permission},
                )
        finally:
            blocker.rollback()
        response = future.result(timeout=race_timeout(15))
    assert response.status_code == 403, response.text
    assert client.get(created.headers["Location"]).json()["status"] == "DRAFT"
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.inventory_entry").scalar() == 0
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.api_idempotency").scalar() == 1
        assert (
            connection.execute(
                text('SELECT count(*) FROM dms.audit_log WHERE "requestId"=:id'),
                {"id": response.headers["X-Request-Id"]},
            ).scalar()
            == 0
        )
