from uuid import uuid4

import pytest
from sqlalchemy import text

from tests.integration.documents.test_receipts import receipt

pytestmark = pytest.mark.integration


@pytest.mark.parametrize(
    "grant", [None, "stock.receipt.prepare", "stock.receipt.post", "inventory.read"]
)
def test_single_grants_and_management_without_grants_follow_source_policy(
    client, engine, product, grant
):
    created = receipt(client, product)
    path = created.headers["Location"]
    with engine.begin() as connection:
        connection.exec_driver_sql(
            'UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1'
        )
        if grant is not None:
            connection.execute(
                text(
                    'UPDATE dms.group_permission SET "isAllowed"=true WHERE "groupId"=1 '
                    'AND "functionId"=(SELECT id FROM dms.app_function WHERE code=:code)'
                ),
                {"code": grant},
            )
    assert client.get(path).status_code == (403 if grant is None else 200)
    assert client.get("/api/v1/stock-receipts").status_code == (403 if grant is None else 200)
    update = client.patch(
        path, json={"note": "Allowed"}, headers={"If-Match": created.headers["ETag"]}
    )
    assert update.status_code == (200 if grant == "stock.receipt.prepare" else 403)
    post = client.post(
        path + "/post",
        headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert post.status_code == (200 if grant == "stock.receipt.post" else 403)
    create = client.post(
        "/api/v1/stock-receipts",
        json={"businessDate": "2026-10-02"},
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert create.status_code == (201 if grant == "stock.receipt.prepare" else 403)


def test_anonymous_requests_cannot_use_any_receipt_operation(client, product):
    created = receipt(client, product)
    path = created.headers["Location"]
    client.headers.pop("Authorization")
    requests = [
        ("GET", "/api/v1/stock-receipts", None),
        ("GET", path, None),
        ("POST", "/api/v1/stock-receipts", {"businessDate": "2026-10-01"}),
        ("PATCH", path, {"note": "Denied"}),
        ("POST", path + "/post", None),
    ]
    for method, target, body in requests:
        response = client.request(
            method,
            target,
            json=body,
            headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
        )
        assert response.status_code == 401, response.text
