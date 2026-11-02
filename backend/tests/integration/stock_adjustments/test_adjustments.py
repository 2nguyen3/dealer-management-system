from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.modules.stock_adjustments.service import StockAdjustmentService
from app.modules.stock_receipts.schemas import Reason
from tests.integration.catalogues.test_races import ordered_race
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def create(client, product, quantity="-3", day="2026-01-02", **values):
    response = client.post(
        "/api/v1/stock-adjustments",
        json={
            "businessDate": day,
            "reason": "Damaged stock",
            "lines": [{"productId": product, "quantity": quantity}],
            **values,
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert response.status_code == 201, response.text
    return response


def post(client, created):
    return client.post(
        created.headers["Location"] + "/post",
        headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )


def service(session, actor):
    return StockAdjustmentService(
        session, CursorCodec(b"x" * 32), actor, "adjustment-test", lambda _: None
    )


def test_signed_stock_only_lifecycle_and_retries(client, engine, trading, actor):
    created = create(client, trading["product"])
    assert_schema(created.json(), "DocumentMutationResult")
    assert created.json()["totalAmount"] == "0"
    path = created.headers["Location"]
    detail = client.get(path)
    assert_schema(detail.json(), "StockAdjustment")
    assert detail.json()["currentRevision"]["lines"][0]["unitPrice"] == "0"
    assert client.patch(path, json={"reason": "Other"}).status_code == 428
    changed = client.patch(
        path,
        json={"reason": "Confirmed damage", "note": None},
        headers={"If-Match": detail.headers["ETag"]},
    )
    assert changed.status_code == 200, changed.text
    assert (
        client.patch(
            path, json={"note": "stale"}, headers={"If-Match": detail.headers["ETag"]}
        ).status_code
        == 412
    )
    headers = {"If-Match": changed.headers["ETag"], "Idempotency-Key": str(uuid4())}
    posted = client.post(path + "/post", headers=headers)
    assert posted.status_code == 200, posted.text
    assert posted.json()["inventoryChanges"][0] == {
        "productId": trading["product"],
        "currentStock": "97",
        "currentPurchasePrice": "100",
        "currentSellingPrice": "102",
    }
    assert client.post(path + "/post", headers=headers).json() == posted.json()
    assert (
        client.patch(
            path, json={"reason": "frozen"}, headers={"If-Match": posted.headers["ETag"]}
        ).status_code
        == 409
    )
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM dms.receivable_entry")) == 0
        assert connection.scalar(text("SELECT count(*) FROM dms.credit_entry")) == 0
        assert connection.scalar(text("SELECT count(*) FROM dms.inventory_entry")) == 2
    added = create(client, trading["product"], "2")
    assert post(client, added).json()["inventoryChanges"][0]["currentStock"] == "99"
    listed = client.get(
        "/api/v1/stock-adjustments", params={"limit": 1, "productId": trading["product"]}
    )
    assert listed.status_code == 200
    cursor = listed.json()["pagination"]["nextCursor"]
    assert (
        client.get(
            "/api/v1/stock-adjustments",
            params={"limit": 1, "productId": trading["product"], "cursor": cursor},
        ).json()["items"][0]["id"]
        != listed.json()["items"][0]["id"]
    )
    cancelled = create(client, trading["product"], "1")
    with Session(engine) as session:
        result = service(session, actor).cancel_draft(
            int(cancelled.json()["id"]),
            Reason(reason="Mistake"),
            Preconditions(cancelled.headers["ETag"]),
            uuid4(),
        )
        assert result.body["status"] == "CANCELLED"


def test_invalid_history_and_inputs_are_atomic(client, engine, trading):
    historical = create(client, trading["product"], "-1", "2025-12-31")
    assert post(client, historical).status_code == 409
    excessive = create(client, trading["product"], "-101")
    assert post(client, excessive).status_code == 409
    for quantity in ("0", "1.0001"):
        assert (
            client.post(
                "/api/v1/stock-adjustments",
                json={
                    "businessDate": "2026-01-02",
                    "reason": "Damage",
                    "lines": [{"productId": trading["product"], "quantity": quantity}],
                },
                headers={"Idempotency-Key": str(uuid4())},
            ).status_code
            == 422
        )
    assert create(client, trading["product"], lines=[]).json()["totalAmount"] == "0"
    with engine.connect() as connection:
        assert connection.scalar(text('SELECT "currentStock" FROM dms.inventory_balance')) == 100
        assert connection.scalar(text("SELECT count(*) FROM dms.inventory_entry")) == 1


def test_competing_negative_posts_preserve_stock(client, engine, actor, trading):
    one = create(client, trading["product"], "-70")
    two = create(client, trading["product"], "-70")
    first, second = ordered_race(
        engine,
        lambda session: service(session, actor).post(
            int(one.json()["id"]), Preconditions(one.headers["ETag"]), uuid4()
        ),
        lambda session: service(session, actor).post(
            int(two.json()["id"]), Preconditions(two.headers["ETag"]), uuid4()
        ),
    )
    assert first.body["status"] == "POSTED" and second == "STOCK_CONFLICT"
    with engine.connect() as connection:
        assert connection.scalar(text('SELECT "currentStock" FROM dms.inventory_balance')) == 30
