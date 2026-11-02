from uuid import uuid4

import pytest
from sqlalchemy import text

from tests.integration.documents.test_receipts import post_receipt, receipt
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_backdated_and_same_day_receipts_select_price_by_business_checkpoint(client, product):
    latest = receipt(client, product, business_date="2026-10-03", quantity="2", price="300")
    assert post_receipt(client, latest).status_code == 200
    older = receipt(client, product, business_date="2026-10-01", quantity="3", price="100")
    backdated = post_receipt(client, older)
    assert backdated.status_code == 200, backdated.text
    assert backdated.json()["inventoryChanges"][0]["currentPurchasePrice"] == "300"
    current = client.get("/api/v1/products/" + product["id"]).json()
    assert current["currentStock"] == "5"
    assert current["priceSource"]["documentId"] == latest.json()["id"]
    same_day = receipt(client, product, business_date="2026-10-03", quantity="1", price="400")
    assert post_receipt(client, same_day).status_code == 200
    current = client.get("/api/v1/products/" + product["id"]).json()
    assert current["currentPurchasePrice"] == "400"
    assert current["priceSource"]["documentId"] == same_day.json()["id"]
    assert current["currentStock"] == "6"


def test_current_stock_overflow_is_a_business_conflict_and_rolls_back(client, engine, product):
    first = receipt(client, product, quantity="900000000000000", price="1")
    assert post_receipt(client, first).status_code == 200
    second = receipt(client, product, quantity="200000000000000", price="1")
    blocked = post_receipt(client, second)
    assert blocked.status_code == 409, blocked.text
    assert blocked.json()["code"] == "STOCK_OVERFLOW"
    assert client.get(second.headers["Location"]).json()["status"] == "DRAFT"
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.inventory_entry").scalar() == 1
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.posting_batch").scalar() == 1
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.api_idempotency").scalar() == 3
        assert (
            connection.execute(
                text('SELECT count(*) FROM dms.audit_log WHERE "requestId"=:id'),
                {"id": blocked.headers["X-Request-Id"]},
            ).scalar()
            == 0
        )


def test_total_overflow_across_lines_and_wide_derived_price(client, engine, product):
    other = client.post(
        "/api/v1/products", json={"name": "Other", "unitId": product["unitId"]}
    ).json()
    body = {
        "businessDate": "2026-10-01",
        "lines": [
            {"productId": item["id"], "quantity": "1", "unitPrice": "600000000000000000"}
            for item in (product, other)
        ],
    }
    blocked = client.post(
        "/api/v1/stock-receipts", json=body, headers={"Idempotency-Key": str(uuid4())}
    )
    assert blocked.status_code == 409 and blocked.json()["code"] == "TOTAL_OVERFLOW"
    rule = client.get("/api/v1/business-rules")
    assert (
        client.patch(
            "/api/v1/business-rules",
            json={"sellingPriceRate": "2"},
            headers={"If-Match": rule.headers["ETag"]},
        ).status_code
        == 200
    )
    created = receipt(client, product, price="600000000000000000")
    posted = post_receipt(client, created)
    assert posted.status_code == 200, posted.text
    assert posted.json()["inventoryChanges"][0]["currentSellingPrice"] == "1200000000000000000"
    assert_schema(posted.json(), "DocumentMutationResult")
