"""Offline route/service contract of the simplified online payments module."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock
from urllib.parse import parse_qsl, urlsplit
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import ApiError, AuthError
from app.modules.auth.dependencies import get_auth_service, get_current_principal
from app.modules.auth.service import Principal
from app.modules.online_payments.dependencies import get_online_payment_service
from app.modules.online_payments.schemas import OnlinePayment, OnlinePaymentCreate
from app.modules.online_payments.service import OnlinePaymentService
from app.modules.online_payments.vnpay import VnpayAdapter
from tests.online_payments.harness import build_app, config

NOW = datetime.now(UTC)
KEY = "0b5f8f0e-8d1f-4c55-9a52-3f1d7a4f8c10"


def row(**values):
    return {
        "id": 7,
        "agencyId": 3,
        "agencyCode": "DL-3",
        "agencyName": "Tạp hóa Hồng Phúc",
        "provider": "VNPAY",
        "merchantReference": "VNP" + "a" * 32,
        "providerTransactionId": None,
        "amount": Decimal(250000),
        "status": "PENDING",
        "expiresAt": NOW + timedelta(minutes=30),
        "paymentTime": None,
        "receiptDocumentId": None,
        "receiptCode": None,
        "createdBy": 1,
        "createdAt": NOW,
        "updatedAt": NOW,
        **values,
    }


def service(adapter="native", authorize=None, **repo):
    instance = OnlinePaymentService(
        Mock(),
        Mock(),
        1,
        "request-1",
        authorize or (lambda _: None),
        settings=config(),
        adapter=VnpayAdapter(config()) if adapter == "native" else adapter,
    )
    instance.repo = Mock(**repo)
    return instance


def payment(**values) -> OnlinePayment:
    return service().project(row(**values))


# ------------------------------------------------------------- projection ----


def test_pending_projection_carries_a_signed_checkout_url():
    item = payment()
    fields = dict(parse_qsl(urlsplit(item.checkoutUrl).query))
    assert fields["vnp_TxnRef"] == item.merchantReference
    assert fields["vnp_Amount"] == "25000000"
    assert item.id == "7" and item.agencyId == "3" and item.createdBy == "1"
    assert item.agencyCode == "DL-3" and item.receiptCode is None
    assert "refund" not in " ".join(OnlinePayment.model_fields).lower()


@pytest.mark.parametrize(
    "values",
    [
        {"status": "FAILED"},
        {"status": "EXPIRED"},
        {"expiresAt": NOW - timedelta(seconds=1)},
        {"provider": "LEGACY"},
    ],
)
def test_checkout_url_only_while_payable(values):
    assert payment(**values).checkoutUrl is None


def test_no_checkout_url_without_configured_adapter():
    assert service(adapter=None).project(row()).checkoutUrl is None


def test_success_projection_requires_receipt_and_evidence():
    item = payment(
        status="SUCCESS",
        providerTransactionId="14123456",
        paymentTime=NOW,
        receiptDocumentId=9,
        receiptCode="PT-9",
    )
    assert item.receiptDocumentId == "9" and item.checkoutUrl is None
    with pytest.raises(ValueError):
        payment(status="SUCCESS", providerTransactionId="1", paymentTime=NOW)
    with pytest.raises(ValueError):
        payment(status="FAILED", receiptDocumentId=9)


def test_create_body_defaults_to_vnpay_and_rejects_invalid_money():
    body = OnlinePaymentCreate.model_validate({"agencyId": "3", "amount": "1000"})
    assert body.provider == "VNPAY" and body.amount == 1000
    for amount in ("0", "-1", "1.5"):
        with pytest.raises(ValueError):
            OnlinePaymentCreate.model_validate({"agencyId": "3", "amount": amount})


# ---------------------------------------------------------------- service ----


@pytest.mark.parametrize(("provider", "adapter"), [("STRIPE", "native"), ("VNPAY", None)])
def test_create_requires_configured_vnpay_before_database_work(provider, adapter):
    instance = service(adapter=adapter)
    body = OnlinePaymentCreate(agencyId="3", provider=provider, amount=Decimal(1000))
    with pytest.raises(ApiError) as error:
        instance.create(body)
    assert (error.value.status, error.value.code) == (422, "UNSUPPORTED_PROVIDER")
    instance.repo.agency.assert_not_called()
    instance.session.commit.assert_not_called()


def test_create_rejects_amounts_outside_vnpay_limits():
    body = OnlinePaymentCreate(agencyId="3", amount=Decimal(10_000_000_000))
    with pytest.raises(ApiError, match="VNPAY_AMOUNT_INVALID"):
        service().create(body)


@pytest.mark.parametrize("status", ["SUCCESS", "FAILED", "EXPIRED"])
def test_reconcile_terminal_payment_never_calls_provider(status):
    adapter = Mock()
    instance = service(adapter=adapter, get=Mock(return_value=row(status=status)))
    with pytest.raises(ApiError) as error:
        instance.reconcile(7)
    assert (error.value.status, error.value.code) == (409, "STATE_CONFLICT")
    assert error.value.details == {"status": status}
    adapter.bind.assert_not_called()


def test_reconcile_without_adapter_is_unavailable():
    instance = service(adapter=None, get=Mock(return_value=row()))
    with pytest.raises(ApiError) as error:
        instance.reconcile(7)
    assert (error.value.status, error.value.code) == (503, "PROVIDER_UNAVAILABLE")


def test_reconcile_rejects_a_query_for_another_reference():
    adapter = Mock()
    adapter.bind.return_value.query_payment.return_value = SimpleNamespace(
        merchantReference="VNPother"
    )
    instance = service(adapter=adapter, get=Mock(return_value=row()))
    with pytest.raises(ApiError, match="INVALID_PROVIDER_RESPONSE"):
        instance.reconcile(7)


def test_missing_payment_is_not_found():
    with pytest.raises(ApiError) as error:
        service(get=Mock(return_value=None)).get(99)
    assert (error.value.status, error.value.code) == (404, "NOT_FOUND")


def test_read_accepts_any_permission_and_denies_when_none():
    granted = []

    def authorize(required):
        granted.append(required)
        if required != ("debt.read",):
            raise AuthError(403, "FORBIDDEN", "Permission denied")

    assert service(authorize=authorize, get=Mock(return_value=row())).get(7).id == "7"
    assert granted == [("payments.online",), ("debt.read",)]

    def deny(required):
        raise AuthError(403, "FORBIDDEN", "Permission denied")

    with pytest.raises(AuthError):
        service(authorize=deny, get=Mock(return_value=row())).get(7)


@pytest.mark.parametrize(
    "filters",
    [
        {"sort": "amount"},
        {"createdFrom": NOW, "createdTo": NOW},
        {"createdFrom": NOW, "createdTo": NOW - timedelta(days=1)},
    ],
)
def test_list_rejects_invalid_sort_and_interval(filters):
    with pytest.raises(ApiError, match="VALIDATION_FAILED"):
        service().list(**filters)


# ----------------------------------------------------------------- routes ----


class FakeAuth:
    def __init__(self, allowed):
        self.allowed = allowed

    def get_current_user(self, principal):
        return SimpleNamespace(allowedFunctions=self.allowed)


@pytest.fixture
def api():
    fake = Mock()
    allowed = ["payments.online"]
    app = build_app(config())
    app.dependency_overrides[get_online_payment_service] = lambda: fake
    app.dependency_overrides[get_current_principal] = lambda: Principal(
        user_id=1, session_id=uuid4(), version=1, claims={}
    )
    app.dependency_overrides[get_auth_service] = lambda: FakeAuth(allowed)
    with TestClient(app) as client:
        yield client, fake, allowed


def test_create_route_returns_location_and_stable_etag(api):
    client, fake, _ = api
    fake.create.return_value = payment()
    body = {"agencyId": "3", "provider": "VNPAY", "amount": "250000"}
    first = client.post("/api/v1/online-payments", json=body, headers={"Idempotency-Key": KEY})
    assert first.status_code == 201
    assert first.headers["Location"] == "/api/v1/online-payments/7"
    assert first.json()["checkoutUrl"].startswith("https://sandbox.vnpayment.vn/")
    assert fake.create.call_args.args[1] == UUID(KEY)
    # A re-signed checkout URL (different client IP) does not change the tag.
    fake.create.return_value = payment().model_copy(update={"checkoutUrl": "https://x.test/"})
    second = client.post("/api/v1/online-payments", json=body)
    assert second.headers["ETag"] == first.headers["ETag"]
    assert fake.create.call_args.args[1] is None


def test_create_route_validates_key_media_type_and_body(api):
    client, fake, _ = api
    body = {"agencyId": "3", "amount": "1000"}
    assert (
        client.post(
            "/api/v1/online-payments", json=body, headers={"Idempotency-Key": "not-a-uuid"}
        ).status_code
        == 422
    )
    assert client.post("/api/v1/online-payments", content=b"{}").status_code == 415
    assert client.post("/api/v1/online-payments", json={"agencyId": "3"}).status_code == 422
    fake.create.assert_not_called()


def test_permissions_guard_writes_and_reads(api):
    client, fake, allowed = api
    fake.get.return_value = payment()
    allowed[:] = ["debt.read"]
    assert client.get("/api/v1/online-payments/7").status_code == 200
    assert client.post("/api/v1/online-payments/7/reconcile").status_code == 403
    assert client.get("/api/v1/online-payments/7/events").status_code == 403
    allowed[:] = ["sales.read"]
    assert client.get("/api/v1/online-payments/7").status_code == 403
    assert client.get("/api/v1/online-payments").status_code == 403


def test_reconcile_route_needs_no_idempotency_key_and_maps_conflict(api):
    client, fake, _ = api
    fake.reconcile.side_effect = ApiError(409, "STATE_CONFLICT", "Online payment is SUCCESS")
    result = client.post("/api/v1/online-payments/7/reconcile")
    assert result.status_code == 409 and result.json()["code"] == "STATE_CONFLICT"
    fake.reconcile.assert_called_once_with(7)
    fake.reconcile.side_effect = None
    fake.reconcile.return_value = payment(status="FAILED")
    result = client.post("/api/v1/online-payments/7/reconcile")
    assert result.status_code == 200 and result.json()["status"] == "FAILED"
    assert result.headers["ETag"]


def test_published_routes_and_operation_ids(api):
    client, _, _ = api
    paths = client.app.openapi()["paths"]
    operations = {
        operation["operationId"]
        for path, methods in paths.items()
        if path.startswith("/api/v1/online-payments")
        for operation in methods.values()
    }
    assert operations == {
        "listOnlinePayments",
        "createOnlinePayment",
        "getOnlinePayment",
        "listPaymentEvents",
        "reconcileOnlinePayment",
        "printOnlinePayment",
    }
    assert not any("webhook" in path or "refund" in path for path in paths)


def test_print_route_returns_pdf_or_html_for_readers(api):
    client, fake, allowed = api
    fake.get.return_value = payment()
    pdf = client.get("/api/v1/online-payments/7/print", headers={"Accept": "application/pdf"})
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")
    assert pdf.headers["content-type"] == "application/pdf"
    assert 'filename="payment-7.pdf"' in pdf.headers["content-disposition"]
    fake.get.assert_called_with(7)
    fake.session.rollback.assert_called()
    html = client.get("/api/v1/online-payments/7/print")
    assert html.status_code == 200 and html.headers["content-type"].startswith("text/html")
    assert "<svg" in html.text and "Phiếu báo thanh toán #7" in html.text
    rejected = client.get("/api/v1/online-payments/7/print", headers={"Accept": "image/png"})
    assert rejected.status_code == 406
    allowed[:] = ["debt.read"]
    assert client.get("/api/v1/online-payments/7/print").status_code == 200
    allowed[:] = ["cash.receipt.prepare"]
    assert client.get("/api/v1/online-payments/7/print").status_code == 403
    allowed[:] = ["payments.online"]
    fake.get.side_effect = ApiError(404, "NOT_FOUND", "Online payment not found")
    assert client.get("/api/v1/online-payments/8/print").status_code == 404
