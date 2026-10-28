from uuid import uuid4

import pytest
from sqlalchemy import text

from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_header_edits_filters_grants_and_safe_errors(credit_client, engine, trading):
    client = credit_client
    body = {"agencyId": trading["agency"], "businessDate": "2026-01-05", "amount": "1"}
    key = str(uuid4())
    created = client.post(
        "/api/v1/credit-applications", json=body, headers={"Idempotency-Key": key}
    )
    assert created.status_code == 201, created.text
    path = created.headers["Location"]
    assert (
        client.post(
            "/api/v1/credit-applications", json=body, headers={"Idempotency-Key": key}
        ).json()
        == created.json()
    )
    assert (
        client.post(
            "/api/v1/credit-applications",
            json={**body, "amount": "2"},
            headers={"Idempotency-Key": key},
        ).status_code
        == 409
    )
    assert client.patch(path, json={"amount": "2"}).status_code == 428
    assert (
        client.patch(path, json={"amount": "2"}, headers={"If-Match": '"stale"'}).status_code == 412
    )
    updated = client.patch(
        path,
        json={"amount": "2", "businessDate": "2026-01-06", "note": "Offset"},
        headers={"If-Match": created.headers["ETag"]},
    )
    assert updated.status_code == 200, updated.text
    assert_schema(updated.json(), "CreditApplication")
    assert updated.json()["currentRevision"]["totalAmount"] == "2"
    assert updated.json()["cashReceived"] == "0"
    assert (
        client.get(
            "/api/v1/credit-applications", params={"q": "Offset", "agencyId": trading["agency"]}
        ).json()["items"][0]["id"]
        == created.json()["id"]
    )
    for payload in ({"agencyId": "2"}, {"amount": None}, {}, {"amount": 2}):
        assert (
            client.patch(
                path, json=payload, headers={"If-Match": updated.headers["ETag"]}
            ).status_code
            == 422
        )
    assert client.get("/api/v1/credit-applications/999999").status_code == 404
    # A receipt belongs to another owning module, regardless of the caller's grants.
    assert client.get("/api/v1/credit-applications/1").status_code == 404
    with engine.begin() as connection:
        connection.execute(
            text("""
            UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1
            AND "functionId"=(SELECT id FROM dms.app_function WHERE code='credit.apply')
        """)
        )
    assert (
        client.post(
            "/api/v1/credit-applications", json=body, headers={"Idempotency-Key": str(uuid4())}
        ).status_code
        == 403
    )
    assert client.get(path).status_code == 200  # debt.read independently permits reads.
