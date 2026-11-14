"""HTTP transport on real PostgreSQL: authenticated checkout and the VNPAY IPN codes."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.integration.online_payments.conftest import DEBT, PASSWORD, counts, debt
from tests.online_payments.harness import build_app, config, ipn_fields

pytestmark = pytest.mark.integration


@pytest.fixture
def client(engine, world):
    with TestClient(build_app(config(), engine)) as client:
        yield client


def login(client, email):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["accessToken"]}


def ipn(client, fields):
    response = client.get("/api/v1/integrations/vnpay/ipn", params=fields)
    assert response.status_code == 200
    return response.json()["RspCode"]


def test_checkout_and_ipn_round_trip(client, world, engine):
    accountant = login(client, "accountant@agentra.vn")
    key = {"Idempotency-Key": "6c1d3a0e-4b7f-4e43-8a8f-1f4f0f8f2a11"}
    payload = {"agencyId": str(world.agency), "provider": "VNPAY", "amount": "300000"}
    created = client.post("/api/v1/online-payments", json=payload, headers=accountant | key)
    assert created.status_code == 201, created.text
    payment = created.json()
    assert created.headers["Location"] == f"/api/v1/online-payments/{payment['id']}"
    assert payment["status"] == "PENDING" and payment["checkoutUrl"]
    replay = client.post("/api/v1/online-payments", json=payload, headers=accountant | key)
    assert replay.status_code == 201 and replay.json()["id"] == payment["id"]
    assert replay.headers["ETag"] == created.headers["ETag"]

    reference = payment["merchantReference"]
    assert ipn(client, {**ipn_fields(reference, 300000), "vnp_Amount": "1"}) == "97"
    assert ipn(client, ipn_fields(reference, 300001)) == "04"
    assert ipn(client, ipn_fields("VNP-seeded-before-reseed", 300000)) == "01"
    assert counts(engine)["payment_event"] == 0
    fields = ipn_fields(reference, 300000)
    assert ipn(client, fields) == "00"
    assert ipn(client, fields) == "02"
    assert debt(engine, world.agency) == DEBT - 300000
    with engine.connect() as connection:
        assert (
            connection.execute(
                text("SELECT count(*) FROM dms.document WHERE \"receiptType\" = 'ONLINE'")
            ).scalar_one()
            == 1
        )

    detail = client.get(f"/api/v1/online-payments/{payment['id']}", headers=accountant)
    assert detail.status_code == 200 and detail.json()["status"] == "SUCCESS"
    assert detail.json()["receiptDocumentId"] and detail.json()["checkoutUrl"] is None
    reconcile = client.post(
        f"/api/v1/online-payments/{payment['id']}/reconcile", headers=accountant
    )
    assert reconcile.status_code == 409 and reconcile.json()["code"] == "STATE_CONFLICT"
    events = client.get(f"/api/v1/online-payments/{payment['id']}/events", headers=accountant)
    assert [item["providerStatus"] for item in events.json()["items"]] == ["SUCCESS"]


def test_http_checkout_rules_and_permissions(client, world, engine):
    accountant = login(client, "accountant@agentra.vn")
    over = {"agencyId": str(world.agency), "amount": str(DEBT + 1)}
    response = client.post("/api/v1/online-payments", json=over, headers=accountant)
    assert response.status_code == 409 and response.json()["code"] == "PAYMENT_EXCEEDS_DEBT"
    terminated = {"agencyId": str(world.terminated), "amount": "1000"}
    response = client.post("/api/v1/online-payments", json=terminated, headers=accountant)
    assert response.status_code == 409 and response.json()["code"] == "AGENCY_TERMINATED"
    sales = login(client, "sales@agentra.vn")
    exact = {"agencyId": str(world.agency), "amount": str(DEBT)}
    assert client.post("/api/v1/online-payments", json=exact, headers=sales).status_code == 403
    # SALES holds debt.read, so it may read but not create or reconcile.
    assert client.get("/api/v1/online-payments", headers=sales).status_code == 200
    assert client.post("/api/v1/online-payments", json=exact).status_code == 401
    assert counts(engine)["online_payment"] == 0


def test_bad_signature_never_reaches_the_database(client, world, engine):
    fields = ipn_fields("VNP" + "1" * 32, 1000)
    fields["vnp_SecureHash"] = "0" * 128
    assert ipn(client, fields) == "97"
    assert ipn(client, ipn_fields("VNP" + "1" * 32, 1000, tmn_code="OTHER123")) == "97"
    assert counts(engine) == {"online_payment": 0, "payment_event": 0, "document": 0}
