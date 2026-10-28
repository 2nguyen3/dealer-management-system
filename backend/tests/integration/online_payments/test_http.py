import hashlib
import hmac
import json
import time
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.modules.online_payments.router import router, webhook_router
from app.modules.online_payments.schemas import Checkout
from tests.integration.settlement_core.helpers import commit, issue
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_authenticated_routes_signed_completion_events_and_scoped_pages(
    client, engine, actor, trading
):
    settings = client.app.state.settings
    settings.payment_provider = "CONTROLLED"
    from pydantic import SecretStr

    settings.payment_webhook_keys = {"k1": SecretStr("synthetic-key")}
    adapter = Mock()
    adapter.create_checkout.return_value = Checkout(
        checkoutUrl="https://controlled.test/checkout", expiresAt="2026-12-01T00:00:00Z"
    )
    client.app.include_router(router, prefix="/api/v1")
    client.app.include_router(webhook_router, prefix="/api/v1")
    agency, product = int(trading["agency"]), int(trading["product"])
    with Session(engine) as session:
        issue(session, actor, (agency, product), day=4, quantity=3)
        commit(session)
    with patch("app.modules.online_payments.dependencies.adapter_for", return_value=adapter):
        body = {"agencyId": str(agency), "provider": "CONTROLLED", "amount": "102"}
        created = client.post(
            "/api/v1/online-payments", json=body, headers={"Idempotency-Key": str(uuid4())}
        )
        assert created.status_code == 201, created.text
        assert_schema(created.json(), "OnlinePayment")
        second = client.post(
            "/api/v1/online-payments", json=body, headers={"Idempotency-Key": str(uuid4())}
        )
        assert second.status_code == 201, second.text
        for sort in ("id", "-id", "createdAt", "-createdAt"):
            page = client.get(
                "/api/v1/online-payments",
                params={"limit": 1, "sort": sort, "agencyId": str(agency)},
            )
            assert page.status_code == 200, page.text
            cursor = page.json()["pagination"]["nextCursor"]
            after = client.get(
                "/api/v1/online-payments",
                params={"limit": 1, "sort": sort, "agencyId": str(agency), "cursor": cursor},
            )
            assert (
                after.status_code == 200
                and after.json()["items"][0]["id"] != page.json()["items"][0]["id"]
            )
            assert (
                client.get(
                    "/api/v1/online-payments",
                    params={"cursor": cursor, "sort": sort, "status": "FAILED"},
                ).status_code
                == 400
            )
        assert client.get(created.headers["Location"]).status_code == 200
        payload = {
            "eventKey": "evt-1",
            "merchantReference": created.json()["merchantReference"],
            "providerTransactionId": "txn-1",
            "amount": "102",
            "status": "SUCCESS",
            "paymentTime": "2026-01-05T00:00:00Z",
        }

        def webhook(payload):
            raw = json.dumps(payload).encode()
            stamp = str(int(time.time()))
            signature = hmac.new(
                b"synthetic-key", stamp.encode() + b"." + raw, hashlib.sha256
            ).hexdigest()
            return client.post(
                "/api/v1/payment-webhooks/CONTROLLED",
                content=raw,
                headers={
                    "Content-Type": "application/json",
                    "X-Webhook-Timestamp": stamp,
                    "X-Webhook-Key-Id": "k1",
                    "X-Webhook-Signature": signature,
                },
            )

        completed = webhook(payload)
        assert completed.status_code == 200, completed.text
        assert_schema(completed.json(), "WebhookAcknowledgement")
        assert webhook(payload).json()["duplicate"]
        events = client.get(
            created.headers["Location"] + "/events", params={"providerStatus": "SUCCESS"}
        )
        assert events.status_code == 200, events.text
        assert_schema(events.json(), "PaymentEventListResponse")
        reconcile_key = str(uuid4())
        reconciled = client.post(
            created.headers["Location"] + "/reconcile", headers={"Idempotency-Key": reconcile_key}
        )
        assert reconciled.status_code == 200, reconciled.text
        assert reconciled.json()["status"] == "SUCCESS" and reconciled.headers["ETag"]
        assert (
            client.post(
                created.headers["Location"] + "/reconcile",
                headers={"Idempotency-Key": reconcile_key},
            ).json()
            == reconciled.json()
        )
        assert client.get("/api/v1/online-payments/999999").status_code == 404
