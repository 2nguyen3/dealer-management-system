import time
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.integration.master_data.test_contract import body_for
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


@pytest.mark.parametrize(
    "action",
    [
        "permissions",
        "rules",
        "product_create",
        "product_update",
        "agency_create",
        "agency_update",
        "agency_terminate",
    ],
)
def test_current_authorization_after_actual_database_lock_wait(client, engine, masters, action):
    if action == "permissions":
        path = "/api/v1/user-groups/2/permissions/1"
        current = client.get(path)
        method, body, headers = "PUT", {"isAllowed": True}, {"If-Match": current.headers["ETag"]}
        table, predicate, permission = "user_group", "id=2", "permissions.manage"
    elif action == "rules":
        path = "/api/v1/business-rules"
        current = client.get(path)
        method, body, headers = (
            "PATCH",
            {"sellingPriceRate": "2"},
            {"If-Match": current.headers["ETag"]},
        )
        table, predicate, permission = "business_rule", "id", "rules.manage"
    else:
        resource = "products" if action.startswith("product") else "agencies"
        body = body_for(resource, masters)
        permission = "product.manage" if resource == "products" else "agency.manage"
        if action.endswith("create"):
            path, method, headers = "/api/v1/" + resource, "POST", {}
            table, predicate = (
                ("unit", f"id={masters[1]}") if resource == "products" else ("business_rule", "id")
            )
        else:
            current = client.post("/api/v1/" + resource, json=body)
            path, method, body = current.headers["Location"], "PATCH", {"name": "Denied"}
            headers = {"If-Match": current.headers["ETag"]}
            table, predicate = (
                ("product", f"id={int(current.json()['id'])}")
                if resource == "products"
                else ("business_rule", "id")
            )
            if action.endswith("terminate"):
                path, method, body = path + "/terminate", "POST", {"reason": "Denied"}
                headers["Idempotency-Key"] = str(uuid4())
    with Session(engine) as blocker, ThreadPoolExecutor(1) as pool:
        blocker.execute(text(f"SELECT id FROM dms.{table} WHERE {predicate} FOR UPDATE"))
        future = pool.submit(client.request, method, path, json=body, headers=headers)
        try:
            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as observer:
                deadline = time.monotonic() + race_timeout(5)
                while time.monotonic() < deadline:
                    blocked = observer.scalar(
                        text(
                            "SELECT pid FROM pg_stat_activity WHERE datname=:db "
                            "AND wait_event_type='Lock' AND query LIKE :query"
                        ),
                        {"db": engine.url.database, "query": "%" + table + "%"},
                    )
                    if blocked:
                        break
                    Event().wait(0.01)
                else:
                    pytest.fail("Expected actual PostgreSQL lock wait")
            with engine.begin() as c:
                c.execute(
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
    with engine.connect() as c:
        assert (
            c.execute(
                text('SELECT count(*) FROM dms.audit_log WHERE "requestId"=:id'),
                {"id": response.headers["X-Request-Id"]},
            ).scalar()
            == 0
        )
