from uuid import uuid4

import pytest
from sqlalchemy import text

from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def issue(client, trading, quantity="1"):
    created = client.post(
        "/api/v1/stock-issues",
        json={
            "agencyId": trading["agency"],
            "businessDate": "2026-01-02",
            "lines": [{"productId": trading["product"], "quantity": quantity}],
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert created.status_code == 201, created.text
    ready = client.post(
        created.headers["Location"] + "/submit",
        headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert ready.status_code == 200, ready.text
    posted = client.post(
        created.headers["Location"] + "/post",
        headers={"If-Match": ready.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert posted.status_code == 200, posted.text
    return client.get(created.headers["Location"])


def create(client, source, quantity="1", day="2026-01-04"):
    result = client.post(
        "/api/v1/sales-returns",
        json={
            "originDocumentId": source.json()["id"],
            "businessDate": day,
            "lines": [
                {
                    "originLineId": source.json()["currentRevision"]["lines"][0]["id"],
                    "quantity": quantity,
                }
            ],
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert result.status_code == 201, result.text
    return result


def post(client, created):
    return client.post(
        created.headers["Location"] + "/post",
        headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )


def test_return_reduces_only_origin_debt_and_preserves_prices(client, engine, trading):
    source = issue(client, trading, "4")
    created = create(client, source, "2")
    assert created.json()["totalAmount"] == "204"
    posted = post(client, created)
    assert posted.status_code == 200, posted.text
    assert_schema(posted.json(), "DocumentMutationResult")
    detail = client.get(created.headers["Location"])
    assert_schema(detail.json(), "SalesReturn")
    assert (
        detail.json()["debtReducedAmount"] == "204" and detail.json()["creditCreatedAmount"] == "0"
    )
    assert posted.json()["agencyBalance"]["currentDebt"] == "204"
    with engine.connect() as connection:
        assert connection.scalar(text('SELECT "currentStock" FROM dms.inventory_balance')) == 98
        assert (
            connection.scalar(text('SELECT "currentPurchasePrice" FROM dms.inventory_balance'))
            == 100
        )
        assert connection.scalar(text("SELECT count(*) FROM dms.document WHERE kind='REFUND'")) == 0


def test_backdated_return_replaces_frozen_rounding_without_mutation(client, engine, trading):
    unit = client.post(
        "/api/v1/units", json={"code": "KG", "name": "Kilogram", "allowsFraction": True}
    )
    assert unit.status_code == 201, unit.text
    product = client.post(
        "/api/v1/products", json={"name": "Fractional goods", "unitId": unit.json()["id"]}
    )
    assert product.status_code == 201, product.text
    trading = {**trading, "product": product.json()["id"]}
    receipt = client.post(
        "/api/v1/stock-receipts",
        json={
            "businessDate": "2026-01-01",
            "lines": [{"productId": trading["product"], "quantity": "100", "unitPrice": "100"}],
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert receipt.status_code == 201, receipt.text
    received = client.post(
        receipt.headers["Location"] + "/post",
        headers={"If-Match": receipt.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert received.status_code == 200, received.text
    source = issue(client, trading, "1")
    late = create(client, source, "0.005", "2026-01-05")
    late_post = post(client, late)
    assert late_post.status_code == 200, late_post.text
    old = client.get(late.headers["Location"]).json()["currentRevision"]
    with engine.begin() as connection:
        connection.execute(
            text("UPDATE dms.agency SET name=:name WHERE id=:id"),
            {"name": "Renamed after return", "id": int(trading["agency"])},
        )
    early = create(client, source, "0.005", "2026-01-04")
    early_post = post(client, early)
    assert early_post.status_code == 200, early_post.text
    newer = client.get(late.headers["Location"]).json()["currentRevision"]
    assert old["totalAmount"] == "1" and newer["totalAmount"] == "0" and newer["revisionNo"] == 2
    assert newer["agencySnapshot"] == old["agencySnapshot"]
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text('SELECT "totalAmount" FROM dms.document_revision WHERE id=:id'),
                {"id": int(old["id"])},
            )
            == 1
        )
        assert connection.scalar(text('SELECT "currentDebt" FROM dms.agency_balance')) == 101
