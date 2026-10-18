from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from tests.integration.catalogues.helpers import install_builders, product
from tests.integration.stock_adjustments.test_adjustments import create, post
from tests.integration.stock_counts.test_counts import action
from tests.integration.stock_counts.test_counts import create as count

pytestmark = pytest.mark.integration


def test_fractional_adjustments_and_count_never_create_a_purchase_price(
    client, engine, actor, trading
):
    with Session(engine) as session:
        install_builders(session, actor)
        unit = session.scalar(
            text("""INSERT INTO dms.unit (code,name,"allowsFraction")
            VALUES ('KG','Kilogram',true) RETURNING id""")
        )
        product_id = str(product(session, unit))
        session.commit()
    rejected = client.post(
        "/api/v1/stock-adjustments",
        json={
            "businessDate": "2026-01-02",
            "reason": "Invalid count unit",
            "lines": [{"productId": trading["product"], "quantity": "-0.5"}],
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert rejected.status_code == 409 and rejected.json()["code"] == "INVALID_QUANTITY"
    positive = post(client, create(client, product_id, "1.125"))
    assert positive.status_code == 200, positive.text
    assert positive.json()["inventoryChanges"][0]["currentStock"] == "1.125"
    negative = post(client, create(client, product_id, "-0.125", "2026-01-03"))
    assert negative.status_code == 200, negative.text
    assert negative.json()["inventoryChanges"][0]["currentStock"] == "1"
    counted = count(client, product_id, "1.001", countedAt="2026-01-04T10:00:00Z")
    confirmed = action(client, counted, "confirm")
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["lines"][0]["bookQuantity"] == "1"
    assert confirmed.json()["lines"][0]["difference"] == "0.001"
    current = client.get("/api/v1/products/" + product_id).json()
    assert current["currentStock"] == "1.001"
    assert current["currentPurchasePrice"] == current["currentSellingPrice"] == "0"
    assert current["priceSource"] is None
    with pytest.raises(DBAPIError) as error, engine.begin() as connection:
        connection.execute(
            text('UPDATE dms.unit SET "allowsFraction"=false WHERE id=:id'), {"id": unit}
        )
    assert error.value.orig.sqlstate == "23514"
