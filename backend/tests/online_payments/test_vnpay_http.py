from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import ApiError
from app.main import create_app
from app.modules.online_payments.dependencies import get_webhook_service
from tests.online_payments.test_vnpay import config, proof, signed


@pytest.fixture
def native_client():
    app = create_app(config())
    service = Mock()
    service.complete.return_value = (SimpleNamespace(id="1"), False)
    app.dependency_overrides[get_webhook_service] = lambda: service
    with TestClient(app) as client:
        yield client, service


def test_native_ipn_verified_completion_and_duplicate(native_client):
    client, service = native_client
    response = client.get("/api/v1/integrations/vnpay/ipn", params=signed(proof(), callback=True))
    assert response.status_code == 200 and response.json()["RspCode"] == "00"
    assert response.headers["Cache-Control"] == "no-store"
    assert service.complete.call_args.args[0] == "VNPAY"
    assert service.complete.call_args.args[1].amount == 100000
    service.complete.return_value = (SimpleNamespace(id="1"), True)
    assert (
        client.get("/api/v1/integrations/vnpay/ipn", params=signed(proof(), callback=True)).json()[
            "RspCode"
        ]
        == "02"
    )


@pytest.mark.parametrize(
    "code,message,expected",
    [
        ("NOT_FOUND", "missing", "01"),
        ("PAYMENT_CONFLICT", "amount differs", "04"),
        ("PAYMENT_CONFLICT", "transaction differs", "99"),
        ("PROVIDER_UNAVAILABLE", "commit failed", "99"),
    ],
)
def test_native_ipn_acknowledges_only_committed_outcomes(native_client, code, message, expected):
    client, service = native_client
    service.complete.side_effect = ApiError(503, code, message)
    result = client.get("/api/v1/integrations/vnpay/ipn", params=signed(proof(), callback=True))
    assert result.json()["RspCode"] == expected
    assert message not in result.text


def test_invalid_and_duplicate_parameters_never_reach_completion(native_client):
    client, service = native_client
    assert client.get("/api/v1/integrations/vnpay/ipn").json()["RspCode"] == "97"
    fields = list(signed(proof(), callback=True).items())
    fields.append(("vnp_Amount", "100"))
    assert client.get("/api/v1/integrations/vnpay/ipn", params=fields).json()["RspCode"] == "97"
    bad = signed(proof(vnp_TransactionStatus="xx"), callback=True)
    assert client.get("/api/v1/integrations/vnpay/ipn", params=bad).json()["RspCode"] == "99"
    service.complete.assert_not_called()


def test_return_is_escaped_readonly_and_does_not_report_payment_as_recorded(native_client):
    client, service = native_client
    fields = signed(proof(vnp_TxnRef="<script>alert(1)</script>"), callback=True)
    result = client.get("/api/v1/integrations/vnpay/return", params=fields)
    assert result.status_code == 200
    assert "&lt;script&gt;" in result.text and "<script>" not in result.text
    assert "IPN" in result.text and result.headers["Referrer-Policy"] == "no-referrer"
    service.complete.assert_not_called()
    assert client.get("/api/v1/integrations/vnpay/return").status_code == 400
    assert not any("/integrations/vnpay" in path for path in client.app.openapi()["paths"])


def test_disabled_native_provider_is_not_acknowledged(native_client):
    client, service = native_client
    client.app.state.settings.vnpay_tmn_code = ""
    assert client.get("/api/v1/integrations/vnpay/ipn").json()["RspCode"] == "99"
    assert client.get("/api/v1/integrations/vnpay/return").status_code == 503
    service.complete.assert_not_called()
