import hashlib
import hmac
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from urllib.parse import parse_qsl, urlsplit

import httpx
import pytest
from starlette.requests import Request

from app.core.exceptions import ApiError
from app.modules.online_payments import dependencies
from app.modules.online_payments.vnpay import (
    QUERY_REQUEST,
    RESPONSE,
    VnpayAdapter,
    adapter_for,
    amount_from_vnpay,
    amount_to_vnpay,
    checked_signature,
    checksum,
    native_time,
)
from tests.online_payments.harness import SECRET, config

NOW = datetime(2026, 10, 25, 4, 5, 6, tzinfo=UTC)
PAYMENT = {
    "merchantReference": "VNP123",
    "createdAt": NOW,
    "expiresAt": NOW + timedelta(minutes=30),
    "providerTransactionId": "123456",
    "amount": Decimal(100000),
}


def adapter(client=None):
    return VnpayAdapter(config(), client=client, clock=lambda: NOW).bind(PAYMENT)


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
    order = None if callback else RESPONSE + ["PromotionCode", "PromotionAmount"]
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
def test_query_rejects_changed_identity_errors_and_non_payment_proof(change):
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


def test_adapter_requires_complete_native_credentials():
    assert isinstance(adapter_for(config()), VnpayAdapter)
    assert adapter_for(config(), ip_address="198.51.100.2").ip_address == "198.51.100.2"
    blank = SimpleNamespace(vnpay_tmn_code="", vnpay_hash_secret=config().vnpay_hash_secret)
    assert adapter_for(blank) is None
    no_secret = SimpleNamespace(
        vnpay_tmn_code="TEST1234", vnpay_hash_secret=SimpleNamespace(get_secret_value=str)
    )
    assert adapter_for(no_secret) is None


def test_bind_detaches_payment_context():
    native = VnpayAdapter(config())
    bound = native.bind(PAYMENT)
    assert native.payment is None and bound.payment == PAYMENT
    assert bound.payment is not PAYMENT
    assert not hasattr(native, "request_refund") and not hasattr(native, "query_refund")


def test_api_transport_is_bounded_and_does_not_follow_redirects(monkeypatch):
    captured = {}

    class Client:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def request(self, method, url, json, headers):
            captured.update(method=method, url=url, json=json)
            return httpx.Response(200, json=signed(proof()))

    monkeypatch.setattr(httpx, "AsyncClient", Client)
    assert adapter().query_payment("VNP123").status == "SUCCESS"
    assert captured["follow_redirects"] is False and captured["method"] == "POST"
    assert captured["url"] == config().vnpay_api_url
    assert captured["json"]["vnp_Command"] == "querydr"


@pytest.mark.parametrize(
    ("vercel", "headers", "expected"),
    [
        (None, [(b"x-forwarded-for", b"198.51.100.2")], "192.0.2.18"),
        ("0", [(b"x-forwarded-for", b"198.51.100.2")], "192.0.2.18"),
        ("1", [(b"x-forwarded-for", b"198.51.100.2")], "198.51.100.2"),
        ("1", [(b"x-forwarded-for", b"2001:db8::2")], "2001:db8::2"),
        ("1", [(b"x-forwarded-for", b"198.51.100.2, 192.0.2.4")], "192.0.2.18"),
        ("1", [(b"x-forwarded-for", b"not-an-ip")], "192.0.2.18"),
        ("1", [(b"x-forwarded-for", b"fe80::1%eth0")], "192.0.2.18"),
        (
            "1",
            [(b"x-forwarded-for", b"198.51.100.2"), (b"x-forwarded-for", b"192.0.2.4")],
            "192.0.2.18",
        ),
    ],
)
def test_checkout_signs_validated_customer_ip(monkeypatch, vercel, headers, expected):
    if vercel is None:
        monkeypatch.delenv("VERCEL", raising=False)
    else:
        monkeypatch.setenv("VERCEL", vercel)
    request = Request({"type": "http", "headers": headers, "client": ("192.0.2.18", 1234)})
    ip = dependencies.payment_client_ip(request)
    assert ip == expected
    checkout = adapter_for(config(), ip_address=ip).bind(PAYMENT).create_checkout("VNP123", 1000)
    assert dict(parse_qsl(urlsplit(checkout.checkoutUrl).query))["vnp_IpAddr"] == expected


@pytest.mark.parametrize("client", [None, ("testclient", 1234)])
def test_no_valid_network_address_has_safe_local_fallback(monkeypatch, client):
    monkeypatch.delenv("VERCEL", raising=False)
    request = Request({"type": "http", "headers": [], "client": client})
    assert dependencies.payment_client_ip(request) == "127.0.0.1"
