import hashlib
import hmac

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.modules.online_payments.router import router, webhook_router


def test_unpublished_probe_raw_signature_checked_before_parse():
    settings = Settings(
        _env_file=None,
        db_host="localhost",
        db_user="test",
        db_password="test",
        auth_signing_key="synthetic-signing-key-at-least-32-bytes",
        payment_provider="CONTROLLED",
        payment_base_url="http://127.0.0.1:19000",
        payment_callback_url="https://callback.test",
        payment_credential="synthetic",
        payment_webhook_keys={"k1": "synthetic-webhook"},
    )
    app = create_app(settings)
    app.include_router(router, prefix="/api/v1")
    app.include_router(webhook_router, prefix="/api/v1")
    from app.db.session import get_session

    app.dependency_overrides[get_session] = lambda: None
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/payment-webhooks/CONTROLLED",
            content=b"not-json",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 401
        from unittest.mock import patch

        timestamp = "1000000"
        signature = hmac.new(
            b"synthetic-webhook", timestamp.encode() + b".not-json", hashlib.sha256
        ).hexdigest()
        with patch("app.modules.online_payments.adapter.time.time", return_value=1000000):
            response = client.post(
                "/api/v1/payment-webhooks/CONTROLLED",
                content=b"not-json",
                headers={
                    "Content-Type": "application/json",
                    "X-Webhook-Timestamp": timestamp,
                    "X-Webhook-Key-Id": "k1",
                    "X-Webhook-Signature": signature,
                },
            )
        assert response.status_code == 400
        with patch("app.modules.online_payments.adapter.time.time", return_value=1000000):
            raw = b"{}"
            signature = hmac.new(
                b"synthetic-webhook", timestamp.encode() + b"." + raw, hashlib.sha256
            ).hexdigest()
            headers = {
                "X-Webhook-Timestamp": timestamp,
                "X-Webhook-Key-Id": "k1",
                "X-Webhook-Signature": signature,
            }
            assert (
                client.post(
                    "/api/v1/payment-webhooks/CONTROLLED", content=raw, headers=headers
                ).status_code
                == 415
            )
            assert (
                client.post(
                    "/api/v1/payment-webhooks/CONTROLLED",
                    content=raw,
                    headers={**headers, "Content-Type": "application/json"},
                ).status_code
                == 422
            )


@pytest.mark.parametrize(
    "values",
    [
        {"payment_provider": "ONLY"},
        {
            "payment_provider": "X",
            "payment_base_url": "javascript:bad",
            "payment_callback_url": "https://callback.test",
            "payment_credential": "synthetic",
            "payment_webhook_keys": {"k": "v"},
        },
        {
            "payment_provider": "X",
            "payment_base_url": "https://controlled.test",
            "payment_callback_url": "https://callback.test",
            "payment_credential": "synthetic",
            "payment_webhook_keys": {"": "empty-id"},
        },
    ],
)
def test_provider_settings_require_complete_valid_configuration(values):
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        Settings(_env_file=None, db_host="localhost", db_user="test", db_password="test", **values)
