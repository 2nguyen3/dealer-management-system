from types import SimpleNamespace
from unittest.mock import Mock
from urllib.parse import parse_qsl, urlsplit

import pytest
from starlette.requests import Request

from app.modules.online_payments import dependencies
from tests.online_payments.test_vnpay import PAYMENT, config


@pytest.mark.parametrize(
    ("vercel", "headers", "expected"),
    [
        (None, [(b"x-forwarded-for", b"198.51.100.2")], "192.0.2.18"),
        ("0", [(b"x-forwarded-for", b"198.51.100.2")], "192.0.2.18"),
        ("1", [(b"x-forwarded-for", b"198.51.100.2")], "198.51.100.2"),
        ("1", [(b"x-forwarded-for", b"2001:db8::2")], "2001:db8::2"),
        ("1", [(b"x-vercel-forwarded-for", b"198.51.100.2")], "192.0.2.18"),
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
def test_request_composition_signs_validated_customer_ip(monkeypatch, vercel, headers, expected):
    if vercel is None:
        monkeypatch.delenv("VERCEL", raising=False)
    else:
        monkeypatch.setenv("VERCEL", vercel)
    request = Request(
        {
            "type": "http",
            "headers": headers,
            "client": ("192.0.2.18", 1234),
            "app": SimpleNamespace(state=SimpleNamespace(settings=config())),
        }
    )
    request.state.request_id = "transport-test"
    base = SimpleNamespace(codec=Mock(), authorize=Mock())
    monkeypatch.setattr(dependencies, "make_service", Mock(return_value=base))
    service = dependencies.get_online_payment_service(
        request, Mock(), SimpleNamespace(user_id=1), Mock()
    )
    checkout = service.adapter.bind(PAYMENT).create_checkout("VNP123", "100000")
    fields = dict(parse_qsl(urlsplit(checkout.checkoutUrl).query))
    assert fields["vnp_IpAddr"] == expected


@pytest.mark.parametrize("client", [None, ("testclient", 1234)])
def test_no_valid_network_address_has_safe_local_fallback(monkeypatch, client):
    monkeypatch.delenv("VERCEL", raising=False)
    request = Request({"type": "http", "headers": [], "client": client})
    assert dependencies.payment_client_ip(request) == "127.0.0.1"
