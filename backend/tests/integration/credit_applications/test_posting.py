from uuid import uuid4

import pytest
from sqlalchemy import text

from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def issue(client, trading):
    created = client.post(
        "/api/v1/stock-issues",
        json={
            "agencyId": trading["agency"],
            "businessDate": "2026-01-04",
            "lines": [{"productId": trading["product"], "quantity": "1"}],
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


def credit(client, trading, amount="102", day="2026-01-04"):
    result = client.post(
        "/api/v1/credit-applications",
        json={"agencyId": trading["agency"], "businessDate": day, "amount": amount},
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert result.status_code == 201, result.text
    return result


def surplus(client, trading, amount="306"):
    # Verified upfront separation supplies actual cash and eligible surplus credit.
    created = client.post(
        "/api/v1/stock-issues",
        json={
            "agencyId": trading["agency"],
            "businessDate": "2026-01-02",
            "immediatePayment": amount,
            "lines": [{"productId": trading["product"], "quantity": "3"}],
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert created.status_code == 201, created.text
    ready = client.post(
        created.headers["Location"] + "/submit",
        headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert ready.status_code == 200, ready.text
    detail = client.get(created.headers["Location"]).json()
    evidence = client.post(
        "/api/v1/upfront-confirmations",
        json={
            "issueRevisionId": detail["currentRevision"]["id"],
            "method": "CASH",
            "amount": amount,
            "receivedAt": "2026-01-03T03:00:00Z",
            "evidenceReference": "cash-count-1",
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert evidence.status_code == 201, evidence.text
    result = client.post(
        evidence.headers["Location"] + "/receive-separately",
        json={"reason": "Separate verified cash before delivery"},
        headers={"If-Match": evidence.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert result.status_code == 200, result.text
    return result


def test_neutral_draft_post_and_same_key_recovery(credit_client, engine, trading):
    client = credit_client
    surplus(client, trading)
    invoice = issue(client, trading)
    created = credit(client, trading)
    assert created.json()["agencyBalance"]["currentDebt"] == "102"
    assert created.json()["agencyBalance"]["currentCredit"] == "306"
    detail = client.get(created.headers["Location"])
    assert_schema(detail.json(), "CreditApplication")
    assert detail.json()["cashReceived"] == "0"
    assert detail.json()["creditUsedAmount"] == "0"
    key = str(uuid4())
    headers = {"If-Match": created.headers["ETag"], "Idempotency-Key": key}
    posted = client.post(created.headers["Location"] + "/post", headers=headers)
    assert posted.status_code == 200, posted.text
    assert_schema(posted.json(), "DocumentMutationResult")
    assert posted.json()["agencyBalance"]["currentDebt"] == "0"
    assert posted.json()["agencyBalance"]["currentCredit"] == "204"
    assert (
        client.post(created.headers["Location"] + "/post", headers=headers).json() == posted.json()
    )
    detail = client.get(created.headers["Location"])
    assert detail.json()["creditUsedAmount"] == "102"
    assert detail.json()["cashReceived"] == "0"
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT count(*) FROM dms.document WHERE kind='PAYMENT_RECEIPT'")
            )
            == 1
        )
        assert (
            connection.scalar(text("SELECT sum(amount) FROM dms.credit_entry WHERE kind='OFFSET'"))
            == -102
        )
        assert (
            connection.scalar(
                text("SELECT sum(amount) FROM dms.receivable_entry WHERE kind='CREDIT'")
            )
            == -102
        )
    assert (
        client.get(f"/api/v1/stock-issues/{invoice.json()['id']}/balance").json()[
            "outstandingAmount"
        ]
        == "0"
    )


def test_insufficient_debt_rolls_back(credit_client, engine, trading):
    client = credit_client
    surplus(client, trading)
    issue(client, trading)
    created = credit(client, trading, "103")
    failed = client.post(
        created.headers["Location"] + "/post",
        headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert failed.status_code == 409, failed.text
    with engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT count(*) FROM dms.credit_entry WHERE kind='OFFSET'"))
            == 0
        )
        assert (
            connection.scalar(text("SELECT count(*) FROM dms.receivable_entry WHERE kind='CREDIT'"))
            == 0
        )
    assert client.get(created.headers["Location"]).json()["status"] == "DRAFT"
