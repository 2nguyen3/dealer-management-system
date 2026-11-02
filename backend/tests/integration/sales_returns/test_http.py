from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from tests.integration.settlement_core.helpers import commit, issue
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_return_http_headers_filters_media_and_durable_post(client, engine, actor, trading):
    with Session(engine) as session:
        source = issue(
            session, actor, (int(trading["agency"]), int(trading["product"])), quantity=3
        )
        commit(session)
    detail = client.get(f"/api/v1/stock-issues/{source}").json()
    body = {
        "originDocumentId": str(source),
        "businessDate": "2026-01-04",
        "lines": [{"originLineId": detail["currentRevision"]["lines"][0]["id"], "quantity": "2"}],
    }
    headers = {"Idempotency-Key": str(uuid4())}
    created = client.post("/api/v1/sales-returns", json=body, headers=headers)
    assert created.status_code == 201, created.text
    path = created.headers["Location"]
    assert client.post("/api/v1/sales-returns", json=body, headers=headers).json() == created.json()
    current = client.get(path)
    assert current.status_code == 200 and current.headers["ETag"] == created.headers["ETag"]
    assert_schema(current.json(), "SalesReturn")
    assert client.patch(path, json={"note": "Missing token"}).status_code == 428
    invalid = client.patch(
        path, json={"businessDate": "2026-01-01"}, headers={"If-Match": current.headers["ETag"]}
    )
    assert invalid.status_code == 409, invalid.text
    updated = client.patch(
        path,
        json={"businessDate": "2026-01-05", "note": "Warehouse return"},
        headers={"If-Match": current.headers["ETag"]},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["currentRevision"]["businessDate"] == "2026-01-05"
    assert (
        client.patch(
            path, json={"note": "stale"}, headers={"If-Match": current.headers["ETag"]}
        ).status_code
        == 412
    )
    post_headers = {"If-Match": updated.headers["ETag"], "Idempotency-Key": str(uuid4())}
    posted = client.post(path + "/post", headers=post_headers)
    assert posted.status_code == 200, posted.text
    assert client.post(path + "/post", headers=post_headers).json() == posted.json()
    assert posted.json()["totalAmount"] == "204"
    listed = client.get(
        "/api/v1/sales-returns",
        params={
            "agencyId": trading["agency"],
            "originDocumentId": str(source),
            "productId": trading["product"],
            "fromDate": "2026-01-05",
            "toDate": "2026-01-06",
            "q": "Warehouse",
            "status": "POSTED",
        },
    )
    assert listed.status_code == 200 and listed.json()["items"][0]["id"] == created.json()["id"], (
        listed.text
    )
    bad = client.post(
        "/api/v1/sales-returns",
        content="{}",
        headers={"Content-Type": "text/plain", "Idempotency-Key": str(uuid4())},
    )
    assert bad.status_code == 415, bad.text
    replacement_price = {**body, "lines": [{**body["lines"][0], "unitPrice": "1"}]}
    assert (
        client.post(
            "/api/v1/sales-returns",
            json=replacement_price,
            headers={"Idempotency-Key": str(uuid4())},
        ).status_code
        == 422
    )
    assert client.post(path + "/cancel", json={"reason": "Unavailable"}).status_code == 404
