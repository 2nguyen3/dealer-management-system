import hashlib
import hmac
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from urllib.parse import parse_qsl, urlsplit

import httpx
import pytest

from app.core.config import Settings
from app.core.exceptions import ApiError
from app.modules.online_payments.dependencies import adapter_for
from app.modules.online_payments.vnpay import (
    QUERY_REQUEST,
    REFUND_REQUEST,
    RESPONSE,
    VnpayAdapter,
    amount_from_vnpay,
    amount_to_vnpay,
    bind_adapter,
    checked_signature,
    checksum,
    native_time,
    provider_for,
)

SECRET = "synthetic-native-vnpay-secret"
NOW = datetime(2026, 10, 25, 4, 5, 6, tzinfo=UTC)
PAYMENT = {
    "merchantReference": "VNP123",
    "createdAt": NOW,
    "expiresAt": NOW + timedelta(minutes=30),
    "providerTransactionId": "123456",
    "amount": Decimal(100000),
}
REFUND = {
    "merchantRefundReference": "REF123",
    "createdAt": NOW,
    "providerRefundId": "456789",
    "amount": Decimal(40000),
}


def config(**values):
    return Settings(
        _env_file=None,
        db_host="localhost",
        db_user="test",
        db_password="test",
        auth_signing_key="synthetic-native-key-at-least-32-bytes",
        vnpay_tmn_code="TEST1234",
        vnpay_hash_secret=SECRET,
        vnpay_ipn_url="https://callback.test/ipn",
        vnpay_return_url="https://callback.test/return",
        **values,
    )


def adapter(client=None):
    return VnpayAdapter(config(), client=client, clock=lambda: NOW).bind(PAYMENT, REFUND, 42)


def proof(**values):
    return {
        "vnp_ResponseId": "response1",
        "vnp_Command": "querydr",
        "vnp_ResponseCode": "00",
        "vnp_Message": "Success",
        "vnp_TmnCode": "TEST1234",
        "vnp_TxnRef": "VNP123",
        "vnp_Amount": "10000000",
        "vnp_BankCode": "NCB",
        "vnp_PayDate": "20261025120506",
        "vnp_TransactionNo": "123456",
        "vnp_TransactionType": "01",
        "vnp_TransactionStatus": "00",
        "vnp_OrderInfo": "Agentra query VNP123",
        **values,
    }


def signed(data, *, callback=False):
    order = (
        None
        if callback
        else RESPONSE
        + (["PromotionCode", "PromotionAmount"] if data["vnp_Command"] == "querydr" else [])
    )
    return {**data, "vnp_SecureHash": checksum(data, SECRET, order)}


def response_client(data):
    return Mock(post=Mock(return_value=httpx.Response(200, json=signed(data))))


def test_signature_known_encoding_and_pipe_order():
    fields = {"b": "+", "a": "x y", "empty": ""}
    assert (
        checksum(fields, SECRET)
        == hmac.new(SECRET.encode(), b"a=x+y&b=%2B", hashlib.sha512).hexdigest()
    )
    assert (
        checksum({"vnp_B": "b", "vnp_A": "a"}, SECRET, ["A", "B", "C"])
        == hmac.new(SECRET.encode(), b"a|b|", hashlib.sha512).hexdigest()
    )
    values = signed(proof(), callback=True)
    values["vnp_SecureHash"] = values["vnp_SecureHash"].upper()
    assert checked_signature(values, SECRET) == proof()


@pytest.mark.parametrize(
    "value,expected", [("1", "100"), (Decimal(100000), "10000000"), ("9999999999", "999999999900")]
)
def test_exact_money_round_trip(value, expected):
    assert amount_to_vnpay(value) == expected
    assert amount_from_vnpay(expected) == str(value)


@pytest.mark.parametrize("value", ["0", "-1", "1.5", "NaN", "Infinity", "10000000000", None])
def test_outbound_money_rejected(value):
    with pytest.raises(ApiError, match="VNPAY_AMOUNT_INVALID"):
        amount_to_vnpay(value)


@pytest.mark.parametrize("value", [None, 100, "", "100.0", "1000000000000", "0", "101", "-100"])
def test_inbound_money_rejected(value):
    with pytest.raises(ApiError, match="INVALID_PROVIDER_RESPONSE"):
        amount_from_vnpay(value)


@pytest.mark.parametrize("value", [None, "20261025", "20260230000000", "2026102512056x"])
def test_native_time_rejected(value):
    with pytest.raises(ApiError):
        native_time(value)


def test_checkout_is_stable_across_clock_changes_and_uses_original_date():
    native = adapter()
    result = native.create_checkout("VNP123", Decimal(100000))
    native.clock = lambda: NOW + timedelta(days=1)
    assert native.create_checkout("VNP123", Decimal(100000)) == result
    fields = dict(parse_qsl(urlsplit(result.checkoutUrl).query))
    assert fields["vnp_CreateDate"] == "20261025110506"
    assert fields["vnp_ExpireDate"] == "20261025113506"
    assert fields["vnp_Amount"] == "10000000"
    assert fields["vnp_ReturnUrl"] == "https://callback.test/return"
    assert checked_signature(fields, SECRET)["vnp_TmnCode"] == "TEST1234"
    assert result.expiresAt == PAYMENT["expiresAt"]


@pytest.mark.parametrize(
    "change", ["duplicate", "alien", "oversize", "many", "signature", "merchant"]
)
def test_callback_signature_and_raw_parameter_boundaries(change):
    values = signed(proof(), callback=True)
    if change == "merchant":
        values = signed(proof(vnp_TmnCode="OTHER123"), callback=True)
    if change == "signature":
        values["vnp_SecureHash"] = "0" * 128
    pairs = list(values.items())
    if change == "duplicate":
        pairs.append(pairs[0])
    elif change == "alien":
        pairs.append(("unsigned", "x"))
    elif change == "oversize":
        pairs.append(("vnp_Long", "x" * 1025))
    elif change == "many":
        pairs.extend((f"vnp_Extra{n}", "x") for n in range(65))
    with pytest.raises(ApiError, match="INVALID_SIGNATURE"):
        adapter().verify_callback(pairs)


def test_callback_and_query_normalize_same_success_event():
    data = proof()
    native = adapter()
    checked = native.verify_callback(list(signed(data, callback=True).items()))
    callback = native.payment_evidence(checked)
    assert callback.paymentTime == NOW + timedelta(hours=1)
    assert callback.amount == 100000
    native.client = response_client(data)
    assert native.query_payment("VNP123") == callback


@pytest.mark.parametrize(
    "state,expected",
    [
        ("01", "PENDING"),
        ("05", "PENDING"),
        ("06", "PENDING"),
        ("02", "FAILED"),
        ("04", "FAILED"),
        ("07", "FAILED"),
        ("09", "FAILED"),
    ],
)
def test_nonterminal_and_failure_evidence(state, expected):
    value = adapter().payment_evidence(proof(vnp_TransactionStatus=state, vnp_TransactionNo="0"))
    assert value.status == expected and value.paymentTime is None
    assert value.providerTransactionId == "0"


def test_signed_gateway_expiry_is_not_misclassified_as_generic_failure():
    value = adapter().payment_evidence(
        proof(vnp_TransactionStatus="02", vnp_ResponseCode="11", vnp_TransactionNo="0")
    )
    assert value.status == "EXPIRED" and value.paymentTime is None


@pytest.mark.parametrize(
    "change",
    [
        {"vnp_ResponseCode": "24"},
        {"vnp_TransactionNo": "0"},
        {"vnp_TransactionNo": "bad"},
        {"vnp_TxnRef": " "},
        {"vnp_TransactionStatus": "99"},
        {"vnp_TransactionType": "03"},
        {"vnp_CurrCode": "USD"},
    ],
)
def test_invalid_payment_proof(change):
    with pytest.raises(ApiError):
        adapter().payment_evidence(proof(**change))
    with pytest.raises(ApiError):
        adapter().payment_evidence({})


def test_query_request_is_signed_in_official_order_and_session_free():
    client = response_client(proof())
    native = adapter(client)
    assert native.query_payment("VNP123").status == "SUCCESS"
    fields = client.post.call_args.kwargs["json"]
    assert fields["vnp_TransactionDate"] == "20261025110506"
    assert checked_signature(fields, SECRET, QUERY_REQUEST)
    native.client = None
    native.transport = AsyncMock(return_value=httpx.Response(200, json=signed(proof())))
    assert native.query_payment("VNP123").status == "SUCCESS"
    native.transport.assert_awaited_once()


@pytest.mark.parametrize(
    "change",
    [
        {"vnp_TmnCode": "OTHER123"},
        {"vnp_Command": "refund"},
        {"vnp_TxnRef": "OTHER"},
        {"vnp_ResponseCode": "91"},
        {"vnp_ResponseCode": "unsafe-provider-text"},
        {"vnp_TransactionType": "03"},
    ],
)
def test_query_rejects_changed_identity_errors_and_refund_proof(change):
    with pytest.raises(ApiError):
        adapter(response_client(proof(**change))).query_payment("VNP123")


@pytest.mark.parametrize(
    "kind", ["timeout", "transport", "status", "json", "list", "float", "bool", "signature"]
)
def test_transport_and_response_failures_are_safe(kind):
    client = response_client(proof())
    if kind == "timeout":
        client.post.side_effect = TimeoutError(SECRET)
    elif kind == "transport":
        client.post.side_effect = httpx.ConnectError(SECRET)
    elif kind == "status":
        client.post.return_value = httpx.Response(503)
    elif kind == "json":
        client.post.return_value = httpx.Response(200, content=SECRET)
    elif kind == "list":
        client.post.return_value = httpx.Response(200, json=[])
    else:
        data = signed(proof())
        data["vnp_Amount" if kind != "signature" else "vnp_SecureHash"] = {
            "float": 100.5,
            "bool": True,
            "signature": "0" * 128,
        }[kind]
        client.post.return_value = httpx.Response(200, json=data)
    with pytest.raises(ApiError) as error:
        adapter(client).query_payment("VNP123")
    assert SECRET not in str(error.value) and SECRET not in error.value.message
    assert error.value.status in (502, 503)


def test_integer_json_amounts_are_exact_not_float():
    native = adapter()
    data = signed(proof())
    data["vnp_Amount"] = 10000000
    native.client = Mock(post=Mock(return_value=httpx.Response(200, json=data)))
    assert native.query_payment("VNP123").amount == 100000


def refund_proof(**values):
    return proof(
        vnp_TransactionType="03",
        vnp_TransactionNo="456789",
        vnp_Amount="4000000",
        vnp_OrderInfo="Agentra refund REF123",
        **values,
    )


def test_refund_request_is_stable_signed_and_bound_to_actor_source():
    client = response_client(refund_proof(vnp_Command="refund"))
    native = adapter(client)
    result = native.request_refund("REF123", "VNP123", Decimal(40000))
    assert result.state == "SUCCESS" and result.providerRefundId == "456789"
    fields = client.post.call_args.kwargs["json"]
    assert len(fields["vnp_RequestId"]) == 32
    assert fields["vnp_CreateBy"] == "42" and fields["vnp_TransactionNo"] == "123456"
    assert fields["vnp_TransactionDate"] == fields["vnp_CreateDate"] == "20261025110506"
    assert checked_signature(fields, SECRET, REFUND_REQUEST)
    native.clock = lambda: NOW + timedelta(days=1)
    native.request_refund("REF123", "VNP123", Decimal(40000))
    assert client.post.call_args.kwargs["json"] == fields


def test_full_refund_uses_transaction_type_02():
    data = refund_proof(vnp_Command="refund")
    data.update(vnp_TransactionType="02", vnp_Amount="10000000")
    native = adapter(response_client(data))
    assert native.request_refund("REF123", "VNP123", Decimal(100000)).state == "SUCCESS"
    assert native.client.post.call_args.kwargs["json"]["vnp_TransactionType"] == "02"


@pytest.mark.parametrize(
    "state,expected", [("05", "PENDING"), ("06", "PENDING"), ("02", "UNKNOWN")]
)
def test_refund_nonterminal_statuses_never_release_money(state, expected):
    result = adapter().refund_evidence(refund_proof(vnp_TransactionStatus=state), "REF123", 40000)
    assert result.state == expected and result.completedAt is None


@pytest.mark.parametrize("pay_date", ["20261025120506", ""])
def test_verified_refund_rejection_has_terminal_observation_time(pay_date):
    result = adapter().refund_evidence(
        refund_proof(vnp_TransactionStatus="09", vnp_PayDate=pay_date), "REF123", 40000
    )
    assert result.state == "FAILED" and result.failureReason == "VNPAY declined refund (09)"
    assert result.completedAt == (NOW + timedelta(hours=1) if pay_date else NOW)


@pytest.mark.parametrize(
    "change",
    [
        {"vnp_TransactionType": "01"},
        {"vnp_OrderInfo": "other"},
        {"vnp_Amount": "4100000"},
        {"vnp_TransactionNo": "0"},
        {"vnp_TransactionNo": "invalid"},
        {"vnp_PayDate": "bad"},
    ],
)
def test_refund_wrong_or_incomplete_proof_rejected(change):
    data = refund_proof()
    data.update(change)
    with pytest.raises(ApiError):
        adapter().refund_evidence(data, "REF123", 40000)


def test_refund_query_requires_known_refund_identity():
    native = adapter(response_client(refund_proof()))
    assert native.query_refund("REF123").state == "SUCCESS"
    assert native.client.post.call_args.kwargs["json"]["vnp_TransactionNo"] == "456789"
    native.refund["providerRefundId"] = "other"
    assert native.query_refund("REF123").state == "UNKNOWN"
    native.refund["providerRefundId"] = None
    assert native.query_refund("REF123").state == "UNKNOWN"
    assert "vnp_TransactionNo" not in native.client.post.call_args.kwargs["json"]


def test_composition_keeps_controlled_protocol_separate_and_detaches_context():
    assert isinstance(adapter_for(config()), VnpayAdapter)
    assert provider_for(config()) == "VNPAY"
    assert provider_for(SimpleNamespace(payment_provider="CONTROLLED")) == "CONTROLLED"
    assert provider_for(SimpleNamespace(payment_provider="")) == ""
    marker = object()
    assert bind_adapter(marker, PAYMENT) is marker
    native = VnpayAdapter(config())
    bound = bind_adapter(native, PAYMENT)
    assert native.payment is None and bound.payment == PAYMENT
    assert bound.refund is None and bound.payment is not PAYMENT
