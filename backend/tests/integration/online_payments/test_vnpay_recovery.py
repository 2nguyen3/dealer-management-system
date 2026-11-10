from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError
from app.modules.online_payments.schemas import OnlinePaymentCreate, VerifiedPayment
from app.modules.online_payments.vnpay import VnpayAdapter
from tests.integration.online_payments.test_vnpay import native_use
from tests.integration.settlement_core.helpers import commit, issue
from tests.online_payments.test_vnpay import config, proof, signed

pytestmark = pytest.mark.integration


def test_native_reconcile_recovers_unopened_checkout_before_query_and_replays(
    client, engine, actor, trading
):
    for name in ("vnpay_tmn_code", "vnpay_hash_secret", "vnpay_ipn_url", "vnpay_return_url"):
        setattr(client.app.state.settings, name, getattr(config(), name))
    with Session(engine) as session:
        issue(session, actor, (int(trading["agency"]), int(trading["product"])), day=4)
        commit(session)
    body = {"agencyId": trading["agency"], "provider": "VNPAY", "amount": "102"}
    create_headers = {"Idempotency-Key": str(uuid4())}
    with patch.object(
        VnpayAdapter,
        "create_checkout",
        side_effect=ApiError(503, "PROVIDER_UNAVAILABLE", "interrupted local setup"),
    ):
        pending = client.post("/api/v1/online-payments", json=body, headers=create_headers)
    assert pending.status_code == 202, pending.text
    assert pending.headers["Retry-After"] == "5"
    assert pending.json()["checkoutUrl"] is None
    reference = pending.json()["merchantReference"]
    missing = signed(proof(vnp_TxnRef=reference, vnp_ResponseCode="91"))
    transport = AsyncMock(return_value=httpx.Response(200, json=missing))
    reconcile_headers = {"Idempotency-Key": str(uuid4())}
    path = pending.headers["Location"]
    with patch.object(VnpayAdapter, "transport", transport):
        recovered = client.post(path + "/reconcile", headers=reconcile_headers)
        assert recovered.status_code == 200, recovered.text
        assert recovered.json()["status"] == "PENDING"
        checkout = recovered.json()["checkoutUrl"]
        assert checkout.startswith("https://sandbox.vnpayment.vn/paymentv2/")
        transport.assert_not_called()
        replay = client.post("/api/v1/online-payments", json=body, headers=create_headers)
        assert replay.status_code == 201, replay.text
        assert replay.json() == recovered.json()
        assert client.get(path).json() == recovered.json()
        transport.assert_not_called()
        with engine.connect() as check:
            assert check.scalar(text("SELECT count(*) FROM dms.online_payment")) == 1
            assert check.scalar(text("SELECT count(*) FROM dms.payment_event")) == 0
            assert check.scalar(text('SELECT "currentDebt" FROM dms.agency_balance')) == 102
            assert (
                check.scalar(
                    text(
                        "SELECT state FROM dms.api_idempotency "
                        "WHERE \"operationId\"='reconcileOnlinePayment'"
                    )
                )
                == "ACCEPTED"
            )
        # The same reconcile command remains usable once checkout exists. A provider
        # absence is still not payment evidence and must not invent an event.
        unavailable = client.post(path + "/reconcile", headers=reconcile_headers)
        assert unavailable.status_code == 503, unavailable.text
        transport.assert_called_once()
        with Session(engine) as session:
            success, duplicate = native_use(session, actor).complete(
                "VNPAY",
                VerifiedPayment(
                    eventKey="recovered-native-success",
                    merchantReference=reference,
                    providerTransactionId="123456",
                    amount="102",
                    status="SUCCESS",
                    paymentTime="2026-01-05T03:00:00Z",
                ),
            )
            assert not duplicate
        with engine.connect() as check:
            history = check.execute(text("SELECT * FROM dms.payment_event ORDER BY id")).all()
        terminal = client.post(path + "/reconcile", headers=reconcile_headers)
        assert terminal.status_code == 200, terminal.text
        assert terminal.json() == success.model_dump(mode="json")
        assert terminal.json()["checkoutUrl"] is None
        assert client.post(path + "/reconcile", headers=reconcile_headers).json() == terminal.json()
        assert client.post(
            path + "/reconcile", headers={"Idempotency-Key": str(uuid4())}
        ).json() == (terminal.json())
        assert client.post("/api/v1/online-payments", json=body, headers=create_headers).json() == (
            terminal.json()
        )
        transport.assert_called_once()
    with engine.connect() as check:
        assert check.scalar(text("SELECT count(*) FROM dms.online_payment")) == 1
        assert (
            check.scalar(text("SELECT count(*) FROM dms.document WHERE kind='PAYMENT_RECEIPT'"))
            == 1
        )
        assert check.execute(text("SELECT * FROM dms.payment_event ORDER BY id")).all() == history
        assert check.scalar(text('SELECT "currentDebt" FROM dms.agency_balance')) == 0
        assert (
            check.scalar(
                text(
                    "SELECT state FROM dms.api_idempotency "
                    'WHERE "operationId"=\'reconcileOnlinePayment\' AND "clientKey"=:key'
                ),
                {"key": reconcile_headers["Idempotency-Key"]},
            )
            == "COMPLETED"
        )

