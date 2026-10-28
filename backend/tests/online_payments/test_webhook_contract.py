from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.modules.online_payments.schemas import OnlinePayment
from tests.auth.test_http import assert_schema_constraints
from tests.support.contract import SOURCE


def test_signature_security_scheme_and_raw_body_contract():
    app = create_app(
        Settings(
            _env_file=None,
            db_host="localhost",
            db_user="test",
            db_password="test",
            auth_signing_key="synthetic-contract-signing-key-32-bytes",
        )
    )
    with TestClient(app) as client:
        document = client.get("/api/openapi.json").json()
    operation = document["paths"]["/api/v1/payment-webhooks/{provider}"]["post"]
    assert operation["security"] == [{"WebhookSignature": []}]
    assert operation["requestBody"]["required"]
    assert operation["x-raw-body"]
    assert (
        document["components"]["securitySchemes"]["WebhookSignature"]["name"]
        == "X-Webhook-Signature"
    )
    assert_schema_constraints(
        SOURCE["components"]["schemas"]["WebhookAcknowledgement"],
        operation["responses"]["200"]["content"]["application/json"]["schema"],
        SOURCE,
        document,
    )
    assert (
        OnlinePayment.model_json_schema()["then"]["properties"]["paymentTime"]
        == SOURCE["components"]["schemas"]["OnlinePayment"]["then"]["properties"]["paymentTime"]
    )
