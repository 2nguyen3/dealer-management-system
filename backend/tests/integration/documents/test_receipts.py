from uuid import uuid4

import pytest

from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def receipt(client, product, *, business_date="2026-10-01", quantity="1", price="100", note=None):
    response = client.post(
        "/api/v1/stock-receipts",
        json={
            "businessDate": business_date,
            "note": note,
            "lines": [{"productId": product["id"], "quantity": quantity, "unitPrice": price}],
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert response.status_code == 201, response.text
    return response


def post_receipt(client, created):
    return client.post(
        created.headers["Location"] + "/post",
        headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )


def test_receipt_draft_header_and_post_are_atomic_keyed_and_exact(client, engine, product):
    path = "/api/v1/stock-receipts"
    body = {
        "businessDate": "2026-10-01",
        "note": "Receipt",
        "lines": [{"productId": product["id"], "quantity": "1.125", "unitPrice": "100"}],
    }
    headers = {"Idempotency-Key": str(uuid4())}
    created = client.post(path, json=body, headers=headers)
    assert created.status_code == 201, created.text
    assert_schema(created.json(), "DocumentMutationResult")
    assert created.json()["status"] == "DRAFT" and created.json()["totalAmount"] == "113"
    assert created.json()["inventoryChanges"] == []
    location = created.headers["Location"]
    detail = client.get(location)
    assert detail.status_code == 200 and detail.headers["ETag"] == created.headers["ETag"]
    assert_schema(detail.json(), "StockReceipt")
    assert detail.json()["currentRevision"]["lines"][0]["productName"] == "Grain"
    assert client.get("/api/v1/products/" + product["id"]).json()["currentStock"] == "0"
    replay = client.post(path, json=body, headers=headers)
    assert replay.json() == created.json() and replay.headers["Location"] == location
    assert client.post(path, json={**body, "note": "Other"}, headers=headers).status_code == 409
    assert client.patch(location, json={"note": "Updated"}).status_code == 428
    updated = client.patch(
        location,
        json={"note": None, "businessDate": "2026-10-02"},
        headers={"If-Match": detail.headers["ETag"]},
    )
    assert updated.status_code == 200, updated.text
    assert_schema(updated.json(), "StockReceipt")
    assert updated.json()["currentRevision"]["note"] is None
    assert (
        client.patch(
            location, json={"note": "Stale"}, headers={"If-Match": detail.headers["ETag"]}
        ).status_code
        == 412
    )
    post_headers = {"If-Match": updated.headers["ETag"], "Idempotency-Key": str(uuid4())}
    posted = client.post(location + "/post", headers=post_headers)
    assert posted.status_code == 200, posted.text
    assert_schema(posted.json(), "DocumentMutationResult")
    assert posted.json()["status"] == "POSTED"
    assert posted.json()["inventoryChanges"] == [
        {
            "productId": product["id"],
            "currentStock": "1.125",
            "currentPurchasePrice": "100",
            "currentSellingPrice": "102",
        }
    ]
    repeated = client.post(location + "/post", headers=post_headers)
    assert repeated.json() == posted.json() and repeated.headers["ETag"] == posted.headers["ETag"]
    assert (
        client.post(
            location + "/post",
            headers={
                **post_headers,
                "If-Match": posted.headers["ETag"],
                "Idempotency-Key": str(uuid4()),
            },
        ).status_code
        == 409
    )
    assert (
        client.patch(
            location, json={"note": "Frozen"}, headers={"If-Match": posted.headers["ETag"]}
        ).status_code
        == 409
    )
    current = client.get(location)
    assert current.json()["currentRevision"]["state"] == "POSTED"
    assert current.json()["currentRevision"]["postedAt"] is not None
    assert current.headers["ETag"] == posted.headers["ETag"]
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.inventory_entry").scalar() == 1
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.posting_batch").scalar() == 1
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.api_idempotency").scalar() == 2
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.receivable_entry").scalar() == 0
