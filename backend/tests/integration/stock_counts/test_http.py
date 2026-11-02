from uuid import uuid4

import pytest

from tests.integration.stock_counts.test_counts import create
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_count_http_detail_and_durable_zero_confirmation(client, trading):
    created = create(client, trading["product"], "100")
    path = created.headers["Location"]
    detail = client.get(path)
    assert detail.status_code == 200, detail.text
    assert_schema(detail.json(), "StockCount")
    assert detail.headers["ETag"] == created.headers["ETag"]
    headers = {"If-Match": detail.headers["ETag"], "Idempotency-Key": str(uuid4())}
    confirmed = client.post(path + "/confirm", headers=headers)
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["adjustmentDocumentId"] is None
    assert client.post(path + "/confirm", headers=headers).json() == confirmed.json()
    assert client.get(path).headers["ETag"] == confirmed.headers["ETag"]
    invalid = client.patch(
        path, json={"bookQuantity": "100"}, headers={"If-Match": confirmed.headers["ETag"]}
    )
    assert invalid.status_code == 422
    assert client.delete(path).status_code == 405
    assert client.get("/api/v1/stock-counts/999999").status_code == 404
