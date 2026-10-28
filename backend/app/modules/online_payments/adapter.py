"""Session-free canonical sandbox boundary; no provider credentials in exceptions."""

import asyncio
import hashlib
import hmac
import re
import time
from urllib.parse import urlsplit

import httpx
from pydantic import ValidationError

from app.core.exceptions import ApiError
from app.modules.online_payments.schemas import Checkout, VerifiedPayment


def verify_signature(raw: bytes, timestamp: str, key_id: str, signature: str, keys, *, now=None):
    secret = keys.get(key_id)
    valid_timestamp = re.fullmatch(r"[0-9]+", timestamp)
    valid_signature = re.fullmatch(r"[0-9a-f]{64}", signature)
    clock = time.time() if now is None else now
    # Bound integer conversion independently of untrusted timestamp length.
    if (
        secret is None
        or not valid_timestamp
        or len(timestamp) > 12
        or abs(clock - int(timestamp)) > 300
        or not valid_signature
    ):
        raise ApiError(401, "INVALID_SIGNATURE", "Webhook signature is invalid")
    expected = hmac.new(
        secret.get_secret_value().encode("utf-8"),
        timestamp.encode("utf-8") + b"." + raw,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise ApiError(401, "INVALID_SIGNATURE", "Webhook signature is invalid")


class SandboxAdapter:
    """Normalized test/sandbox protocol. External acceptance requires D07 evidence."""

    def __init__(self, base_url, credential, callback_url, *, timeout=5, client=None):
        self.base_url = base_url.rstrip("/")
        self.credential = credential
        self.callback_url = callback_url
        self.timeout = timeout
        self.client = client

    def request(self, method, path, model, *, payload=None):
        headers = {"Authorization": "Bearer " + self.credential.get_secret_value()}
        try:
            if self.client is None:
                response = asyncio.run(self.transport(method, path, payload, headers))
            else:
                response = self.client.request(
                    method, self.base_url + path, json=payload, headers=headers
                )
            if response.status_code >= 500:
                raise ApiError(503, "PROVIDER_UNAVAILABLE", "Payment provider unavailable")
            if response.status_code == 404 and path == "/refunds/query":
                from app.modules.refunds.schemas import DefinitiveRefundAbsence

                absence = DefinitiveRefundAbsence.model_validate_json(response.content)
                if absence.merchantRefundReference != payload["merchantRefundReference"]:
                    raise ApiError(
                        502, "INVALID_PROVIDER_RESPONSE", "Refund absence reference differs"
                    )
                raise ApiError(
                    404, "PROVIDER_REFERENCE_NOT_FOUND", "Refund reference is definitively absent"
                )
            if response.status_code != 200:
                raise ApiError(
                    502, "INVALID_PROVIDER_RESPONSE", "Invalid payment provider response"
                )
            return model.model_validate_json(response.content)
        except (httpx.TransportError, TimeoutError):
            raise ApiError(503, "PROVIDER_UNAVAILABLE", "Payment provider unavailable") from None
        except ValidationError:
            raise ApiError(
                502, "INVALID_PROVIDER_RESPONSE", "Invalid payment provider response"
            ) from None

    async def transport(self, method, path, payload, headers):
        # HTTPX's socket read timeout alone resets for each chunk. The outer
        # deadline also bounds slow headers/body trickles and client cleanup.
        async with asyncio.timeout(self.timeout):
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout), follow_redirects=False
            ) as client:
                return await client.request(
                    method, self.base_url + path, json=payload, headers=headers
                )

    def create_checkout(self, reference, amount):
        checkout = self.request(
            "POST",
            "/checkouts",
            Checkout,
            payload={
                "merchantReference": reference,
                "amount": str(amount),
                "callbackUrl": self.callback_url,
            },
        )
        url = urlsplit(checkout.checkoutUrl)
        if url.scheme not in ("https", "http") or not url.hostname or url.username or url.password:
            raise ApiError(502, "INVALID_PROVIDER_RESPONSE", "Invalid checkout URL")
        return checkout

    def query_payment(self, reference):
        # Reference is sent only as JSON data; historical references need not use
        # the current generator's spelling and never become a URL/path.
        if not isinstance(reference, str) or not reference.strip():
            raise ValueError("Invalid server payment reference")
        return self.request(
            "POST", "/payments/query", VerifiedPayment, payload={"merchantReference": reference}
        )

    def request_refund(self, reference, payment_reference, amount):
        from app.modules.refunds.schemas import VerifiedRefund

        return self.request(
            "POST",
            "/refunds",
            VerifiedRefund,
            payload={
                "merchantRefundReference": reference,
                "merchantReference": payment_reference,
                "amount": str(amount),
            },
        )

    def query_refund(self, reference):
        from app.modules.refunds.schemas import VerifiedRefund

        return self.request(
            "POST", "/refunds/query", VerifiedRefund, payload={"merchantRefundReference": reference}
        )
