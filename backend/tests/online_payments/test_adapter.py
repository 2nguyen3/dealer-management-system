import hashlib
import hmac

import httpx
import pytest
from pydantic import SecretStr, ValidationError

from app.core.exceptions import ApiError
from app.modules.online_payments.adapter import SandboxAdapter, verify_signature
from app.modules.online_payments.schemas import VerifiedPayment


@pytest.mark.parametrize("offset", [-301, -300, 0, 300, 301])
def test_signature_exact_boundaries_before_json(offset):
    raw, timestamp = b"not-json", str(1000000 + offset)
    key = SecretStr("synthetic-webhook-secret")
    signature = hmac.new(
        key.get_secret_value().encode(), timestamp.encode() + b"." + raw, hashlib.sha256
    ).hexdigest()
    if abs(offset) <= 300:
        verify_signature(raw, timestamp, "k1", signature, {"k1": key}, now=1000000)
    else:
        with pytest.raises(ApiError, match="INVALID_SIGNATURE"):
            verify_signature(raw, timestamp, "k1", signature, {"k1": key}, now=1000000)


@pytest.mark.parametrize(
    "timestamp,key_id,signature",
    [
        ("abc", "k1", "0" * 64),
        ("1" * 100, "k1", "0" * 64),
        ("1000000", "unknown", "0" * 64),
        ("1000000", "k1", "A" * 64),
        ("1000000", "k1", "0" * 64),
    ],
)
def test_bad_signature(timestamp, key_id, signature):
    with pytest.raises(ApiError, match="INVALID_SIGNATURE"):
        verify_signature(
            b"{}", timestamp, key_id, signature, {"k1": SecretStr("synthetic")}, now=1000000
        )


def test_success_requires_time_and_exact_money():
    body = dict(
        eventKey="e", merchantReference="r", providerTransactionId="t", amount="1", status="SUCCESS"
    )
    with pytest.raises(ValidationError):
        VerifiedPayment(**body)
    assert VerifiedPayment(**body, paymentTime="2026-01-01T00:00:00Z").amount == 1
    with pytest.raises(ValidationError):
        VerifiedPayment(**{**body, "amount": 1}, paymentTime="2026-01-01T00:00:00Z")


def test_terminal_projection_rejects_incomplete_evidence():
    from app.modules.online_payments.schemas import OnlinePayment

    body = dict(
        id="1",
        agencyId="1",
        provider="CONTROLLED",
        merchantReference="r",
        providerTransactionId=None,
        amount="1",
        status="SUCCESS",
        expiresAt="2026-12-01T00:00:00Z",
        paymentTime=None,
        receiptDocumentId=None,
        createdBy="1",
        checkoutUrl=None,
        createdAt="2026-01-01T00:00:00Z",
        updatedAt="2026-01-01T00:00:00Z",
    )
    with pytest.raises(ValidationError):
        OnlinePayment(**body)
    with pytest.raises(ValidationError):
        OnlinePayment(**{**body, "status": "PENDING", "receiptDocumentId": "2"})


@pytest.mark.parametrize("mode", ["ok", "500", "401", "invalid", "timeout", "badurl"])
def test_transport_safe_errors(mode):
    def handler(request):
        assert request.headers["Authorization"] == "Bearer sentinel-secret"
        if mode == "timeout":
            raise httpx.ReadTimeout("sentinel-secret", request=request)
        if mode in ("500", "401"):
            return httpx.Response(int(mode), text="sentinel-secret")
        if mode == "invalid":
            return httpx.Response(200, content=b"sentinel-secret")
        return httpx.Response(
            200,
            json={
                "checkoutUrl": "javascript:alert(1)"
                if mode == "badurl"
                else "https://sandbox.test/checkout/1",
                "expiresAt": "2026-01-01T00:00:00Z",
            },
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        adapter = SandboxAdapter(
            "https://sandbox.test",
            SecretStr("sentinel-secret"),
            "https://callback.test",
            client=client,
        )
        if mode == "ok":
            assert adapter.create_checkout("reference", 1).checkoutUrl.endswith("/1")
        else:
            with pytest.raises(ApiError) as caught:
                adapter.create_checkout("reference", 1)
            assert "sentinel-secret" not in str(caught.value)
