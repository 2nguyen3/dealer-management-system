from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import ApiError
from app.modules.online_payments.dependencies import get_webhook_service
from tests.online_payments.harness import build_app, config
from tests.online_payments.test_vnpay import proof, signed


@pytest.fixture
def native_client():
    app = build_app(config())
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
        ("NOT_FOUND", "Online payment not found", "01"),
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


def test_return_is_escaped_readonly_and_looks_up_the_recorded_payment(native_client):
    client, service = native_client
    service.payer_outcome.return_value = None
    fields = signed(proof(vnp_TxnRef="<script>alert(1)</script>"), callback=True)
    result = client.get("/api/v1/integrations/vnpay/return", params=fields)
    assert result.status_code == 200
    assert "&lt;script&gt;" in result.text and "<script>alert" not in result.text
    assert result.headers["Referrer-Policy"] == "no-referrer"
    assert "script-src 'sha256-" in result.headers["Content-Security-Policy"]
    assert "Đang xác nhận thanh toán" in result.text and "Biên lai thanh toán" not in result.text
    service.payer_outcome.assert_called_once_with("<script>alert(1)</script>", reconcile=True)
    service.complete.assert_not_called()
    assert client.get("/api/v1/integrations/vnpay/return").status_code == 400
    assert not any("/integrations/vnpay" in path for path in client.app.openapi()["paths"])


def test_return_shows_the_receipt_only_for_a_recorded_success(native_client):
    client, service = native_client
    service.payer_outcome.return_value = {
        "status": "SUCCESS",
        "amount": Decimal(100000),
        "agencyName": "Tạp hóa Hồng Phúc",
        "agencyCode": "DL-3",
        "receiptCode": "PT-2026-0042",
        "paymentTime": datetime(2026, 10, 25, 5, 5, 6, tzinfo=UTC),
        "providerTransactionId": "123456",
        "merchantReference": "VNP123",
        "agencyDebt": Decimal(2500000),
    }
    text = client.get(
        "/api/v1/integrations/vnpay/return", params=signed(proof(), callback=True)
    ).text
    for expected in (
        "Thanh toán thành công",
        "Biên lai thanh toán",
        "PT-2026-0042",
        "100.000 ₫",
        "Một trăm nghìn đồng",
        "12:05:06 25/10/2026",
        "2.500.000 ₫",
        "NCB",
        "data-print",
    ):
        assert expected in text


def test_return_receipt_labels_an_overpaid_debt(native_client):
    client, service = native_client
    service.payer_outcome.return_value = {
        "status": "SUCCESS",
        "amount": Decimal(100000),
        "agencyDebt": Decimal(-2500),
    }
    params = signed(proof(), callback=True)
    text = client.get("/api/v1/integrations/vnpay/return", params=params).text
    assert "Số tiền trả dư" in text and "2.500 ₫" in text and "Công nợ còn lại" not in text


def test_return_never_shows_success_from_parameters_alone(native_client):
    client, service = native_client
    service.payer_outcome.return_value = {"status": "PENDING", "amount": Decimal(100000)}
    text = client.get(
        "/api/v1/integrations/vnpay/return", params=signed(proof(), callback=True)
    ).text
    assert "Đang xác nhận" in text and 'http-equiv="refresh"' in text
    assert "Thanh toán thành công" not in text


def test_return_cancelled_payment_is_unsuccessful_without_query(native_client):
    client, service = native_client
    service.payer_outcome.return_value = {"status": "PENDING", "amount": Decimal(100000)}
    fields = signed(proof(vnp_ResponseCode="24", vnp_TransactionStatus="02"), callback=True)
    text = client.get("/api/v1/integrations/vnpay/return", params=fields).text
    assert "Thanh toán chưa thành công" in text and "Bạn đã hủy giao dịch." in text
    assert service.payer_outcome.call_args.kwargs == {"reconcile": False}


def test_return_recorded_failure_wins_over_parameters(native_client):
    client, service = native_client
    service.payer_outcome.return_value = {"status": "EXPIRED", "amount": Decimal(100000)}
    text = client.get(
        "/api/v1/integrations/vnpay/return", params=signed(proof(), callback=True)
    ).text
    assert "chưa thành công" in text and "Đã hết thời gian chờ thanh toán." in text


def test_return_lookup_failure_still_renders(native_client):
    client, service = native_client
    service.payer_outcome.side_effect = RuntimeError("database exploded")
    fields = signed(proof(vnp_ResponseCode="51", vnp_TransactionStatus="02"), callback=True)
    result = client.get("/api/v1/integrations/vnpay/return", params=fields)
    assert result.status_code == 200 and "Tài khoản không đủ số dư." in result.text
    assert "exploded" not in result.text


def test_disabled_native_provider_is_not_acknowledged(native_client):
    client, service = native_client
    client.app.state.settings.vnpay_tmn_code = ""
    assert client.get("/api/v1/integrations/vnpay/ipn").json()["RspCode"] == "99"
    assert client.get("/api/v1/integrations/vnpay/return").status_code == 503
    service.complete.assert_not_called()


def test_unexpected_failure_is_retryable_never_http_500(native_client):
    client, service = native_client
    service.complete.side_effect = RuntimeError("database exploded")
    result = client.get("/api/v1/integrations/vnpay/ipn", params=signed(proof(), callback=True))
    assert result.status_code == 200
    assert result.json() == {"RspCode": "99", "Message": "Please retry"}
    assert "exploded" not in result.text


def test_unknown_order_reference_is_order_not_found(native_client):
    client, service = native_client
    service.complete.side_effect = ApiError(404, "NOT_FOUND", "Online payment not found")
    fields = signed(proof(vnp_TxnRef="VNP-from-before-reseed"), callback=True)
    result = client.get("/api/v1/integrations/vnpay/ipn", params=fields)
    assert result.status_code == 200
    assert result.json() == {"RspCode": "01", "Message": "Order not found"}
    assert service.complete.call_args.args[1].merchantReference == "VNP-from-before-reseed"
