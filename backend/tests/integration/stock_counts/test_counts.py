from uuid import uuid4

import pytest
from sqlalchemy import text

from tests.integration.stock_adjustments.test_adjustments import create as adjustment
from tests.integration.stock_adjustments.test_adjustments import post
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def create(client, product, quantity="97", **values):
    result = client.post(
        "/api/v1/stock-counts",
        json={
            "countedAt": "2026-01-02T10:00:00Z",
            "reason": "Physical count",
            "lines": [{"productId": product, "countedQuantity": quantity}],
            **values,
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert result.status_code == 201, result.text
    assert_schema(result.json(), "StockCount")
    return result


def action(client, created, suffix, body=None):
    arguments = {} if body is None else {"json": body}
    return client.post(
        created.headers.get("Location", f"/api/v1/stock-counts/{created.json()['id']}")
        + "/"
        + suffix,
        headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
        **arguments,
    )


def test_count_confirm_is_atomic_and_linked_adjustment_immutable(client, engine, trading):
    created = create(client, trading["product"])
    confirmed = action(client, created, "confirm")
    assert confirmed.status_code == 200, confirmed.text
    assert_schema(confirmed.json(), "StockCount")
    identifier = confirmed.json()["adjustmentDocumentId"]
    assert identifier is not None
    source = client.get("/api/v1/stock-adjustments/" + identifier)
    assert source.json()["stockCountId"] == created.json()["id"]
    assert source.json()["currentRevision"]["lines"][0]["quantity"] == "-3"
    assert (
        client.patch(
            source.request.url.path,
            json={"reason": "overwrite"},
            headers={"If-Match": source.headers["ETag"]},
        ).status_code
        == 409
    )
    assert (
        client.patch(
            created.headers["Location"],
            json={"reason": "overwrite"},
            headers={"If-Match": confirmed.headers["ETag"]},
        ).status_code
        == 409
    )
    with engine.connect() as connection:
        assert connection.scalar(text('SELECT "currentStock" FROM dms.inventory_balance')) == 97
        assert connection.scalar(text("SELECT count(*) FROM dms.receivable_entry")) == 0
        assert connection.scalar(text("SELECT count(*) FROM dms.credit_entry")) == 0


def test_same_quantity_movement_is_stale_until_fresh_recount(client, engine, trading):
    created = create(client, trading["product"], "100")
    assert post(client, adjustment(client, trading["product"], "1")).status_code == 200
    assert post(client, adjustment(client, trading["product"], "-1")).status_code == 200
    stale = action(client, created, "confirm")
    assert stale.status_code == 409 and stale.json()["code"] == "STALE_STOCK_SNAPSHOT", stale.text
    recounted = action(
        client,
        created,
        "recount",
        {
            "countedAt": "2026-01-03T10:00:00Z",
            "reason": "Counted again",
            "lines": [{"productId": trading["product"], "countedQuantity": "100"}],
        },
    )
    assert recounted.status_code == 200, recounted.text
    confirmed = action(client, recounted, "confirm")
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["adjustmentDocumentId"] is None
    assert confirmed.json()["lines"][0]["difference"] == "0"
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT count(*) FROM dms.document WHERE kind='STOCK_ADJUSTMENT'")
            )
            == 2
        )


def test_count_line_edits_and_parent_tokens_preserve_observations(client, trading):
    created = create(client, trading["product"], lines=[])
    path = created.headers["Location"]
    added = client.post(
        path + "/lines",
        json={"productId": trading["product"], "countedQuantity": "98"},
        headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert added.status_code == 201, added.text
    assert_schema(added.json(), "StockCountLine")
    assert client.get(added.headers["Location"]).status_code == 200
    updated = client.patch(
        added.headers["Location"],
        json={"countedQuantity": "99"},
        headers={"If-Match": added.headers["ETag"]},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["bookQuantity"] == "100" and updated.json()["difference"] == "-1"
    header = client.patch(
        path, json={"reason": "Revised note"}, headers={"If-Match": updated.headers["ETag"]}
    )
    assert header.status_code == 200, header.text
    listed = client.get(path + "/lines", params={"hasDifference": True})
    assert listed.status_code == 200 and len(listed.json()["items"]) == 1
    listing = client.get("/api/v1/stock-counts", params={"productId": trading["product"]})
    assert listing.status_code == 200 and len(listing.json()["items"]) == 1, listing.text
