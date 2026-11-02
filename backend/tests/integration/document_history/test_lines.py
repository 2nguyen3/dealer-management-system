from uuid import uuid4

import pytest
from sqlalchemy import text

from tests.integration.sales_returns.test_returns import issue
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


@pytest.mark.parametrize(
    "kind,path",
    [
        ("STOCK_RECEIPT", "stock-receipts"),
        ("STOCK_ISSUE", "stock-issues"),
        ("STOCK_ADJUSTMENT", "stock-adjustments"),
    ],
)
def test_three_goods_dispatchers_parent_tokens_and_frozen_posted(
    history_client, engine, trading, kind, path
):
    client = history_client
    payload = {"businessDate": "2026-01-05"}
    if kind == "STOCK_ISSUE":
        payload["agencyId"] = trading["agency"]
    if kind == "STOCK_ADJUSTMENT":
        payload["reason"] = "Count correction"
    created = client.post(
        "/api/v1/" + path, json=payload, headers={"Idempotency-Key": str(uuid4())}
    )
    assert created.status_code == 201, created.text
    identifier = created.json()["id"]
    base = f"/api/v1/documents/{identifier}/revisions/1/lines"
    body = {"kind": kind, "productId": trading["product"], "quantity": "2"}
    if kind == "STOCK_RECEIPT":
        body["unitPrice"] = "50"
    assert (
        client.post(base, json=body, headers={"Idempotency-Key": str(uuid4())}).status_code == 428
    )
    added = client.post(
        base,
        json=body,
        headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert added.status_code == 201, added.text
    assert_schema(added.json(), "DocumentLine")
    assert added.json()["unitPrice"] == (
        "50" if kind == "STOCK_RECEIPT" else "102" if kind == "STOCK_ISSUE" else "0"
    )
    line = added.headers["Location"]
    assert client.get(line).headers["ETag"] == added.headers["ETag"]
    assert (
        client.put(
            line, json={**body, "quantity": "1"}, headers={"If-Match": created.headers["ETag"]}
        ).status_code
        == 412
    )
    replaced = client.put(
        line, json={**body, "quantity": "1"}, headers={"If-Match": added.headers["ETag"]}
    )
    assert replaced.status_code == 200, replaced.text
    deleted = client.delete(line, headers={"If-Match": replaced.headers["ETag"]})
    assert deleted.status_code == 204 and deleted.content == b""
    assert deleted.headers["ETag"] == client.get(created.headers["Location"]).headers["ETag"]
    assert client.get(line).status_code == 404
    with engine.connect() as check:
        assert check.scalar(text('SELECT "currentStock" FROM dms.inventory_balance')) == 100
        assert check.scalar(text('SELECT "currentDebt" FROM dms.agency_balance')) == 0


def test_return_dispatch_preserves_original_line_snapshots_and_rounding(history_client, trading):
    client = history_client
    source = issue(client, trading, "3")
    created = client.post(
        "/api/v1/sales-returns",
        json={"originDocumentId": source.json()["id"], "businessDate": "2026-01-06"},
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert created.status_code == 201, created.text
    base = f"/api/v1/documents/{created.json()['id']}/revisions/1/lines"
    body = {
        "kind": "SALES_RETURN",
        "originLineId": source.json()["currentRevision"]["lines"][0]["id"],
        "quantity": "2",
    }
    added = client.post(
        base,
        json=body,
        headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert added.status_code == 201, added.text
    assert added.json()["returnAmount"] == "204"
    replaced = client.put(
        added.headers["Location"],
        json={**body, "quantity": "1"},
        headers={"If-Match": added.headers["ETag"]},
    )
    assert replaced.status_code == 200, replaced.text
    assert (
        replaced.json()["originLineId"] == body["originLineId"]
        and replaced.json()["returnAmount"] == "102"
    )
    assert (
        client.delete(
            added.headers["Location"], headers={"If-Match": replaced.headers["ETag"]}
        ).status_code
        == 204
    )
