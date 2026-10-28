from unittest.mock import Mock

import pytest
from pydantic import SecretStr
from sqlalchemy.exc import DBAPIError

from app.core.exceptions import ApiError
from app.modules.online_payments.dependencies import adapter_for
from app.modules.online_payments.service import OnlinePaymentService


def test_provider_configuration_absent_and_enabled_adapter():
    settings = Mock(payment_provider="", vnpay_tmn_code="")
    assert adapter_for(settings) is None
    settings.payment_provider = "CONTROLLED"
    settings.payment_base_url = "https://controlled.test"
    settings.payment_callback_url = "https://callback.test"
    settings.payment_credential = SecretStr("synthetic")
    settings.payment_timeout_seconds = 5
    assert adapter_for(settings).base_url == "https://controlled.test"


def test_database_discovery_errors_are_safe_retryable_responses():
    session = Mock()
    failure = DBAPIError(None, None, Exception("credential-sentinel"), connection_invalidated=True)
    session.execute.side_effect = failure
    service = OnlinePaymentService(session, Mock(), None, "test", lambda _: None, Mock(), None)
    for action in (
        lambda: service.setup(1, None),
        lambda: service.complete("CONTROLLED", Mock(merchantReference="r")),
    ):
        with pytest.raises(ApiError) as caught:
            action()
        assert caught.value.status == 503
        assert "credential-sentinel" not in str(caught.value)


def test_accepted_transport_response_preserves_location_and_retry_after():
    from uuid import uuid4

    from app.common.commands import CommandResult
    from app.modules.online_payments.router import create_online_payment, payment_responses
    from app.modules.online_payments.schemas import OnlinePaymentCreate

    service = Mock()
    service.create.return_value = CommandResult(
        status=202,
        body={"id": "1", "status": "PENDING"},
        headers={"Location": "/api/v1/online-payments/1"},
    )
    response = create_online_payment(
        OnlinePaymentCreate(agencyId="1", provider="CONTROLLED", amount="1"), None, service, uuid4()
    )
    assert response.status_code == 202 and response.headers["Retry-After"] == "5"
    assert response.headers["Location"].endswith("/1")
    assert "Retry-After" not in payment_responses(200)[200]["headers"]


def test_intent_retry_budget_is_bounded_and_never_dispatches_before_acceptance():
    from types import SimpleNamespace
    from unittest.mock import patch
    from uuid import uuid4

    from app.common.commands import CommandRepository
    from app.modules.online_payments.schemas import OnlinePaymentCreate
    from app.modules.refunds.online import OnlineRefundService

    failure = DBAPIError(None, None, SimpleNamespace(sqlstate="40001"))
    session = Mock()
    adapter = Mock()
    payment = OnlinePaymentService(
        session, Mock(), 1, "retry-bound", lambda _: None, Mock(), adapter
    )
    refund = OnlineRefundService(session, Mock(), 1, "retry-bound", lambda _: None, adapter)
    for action in (
        lambda: payment.create(
            OnlinePaymentCreate(agencyId="1", provider="CONTROLLED", amount="1"), uuid4()
        ),
        lambda: refund.request(1, None, uuid4()),
    ):
        with patch.object(CommandRepository, "claim", side_effect=failure) as claim:
            with pytest.raises(ApiError) as caught:
                action()
            assert caught.value.status == 503 and claim.call_count == 3
            assert len({call.args[0].client_key for call in claim.call_args_list}) == 1
            assert len({call.args[1] for call in claim.call_args_list}) == 1
    adapter.create_checkout.assert_not_called()
    adapter.request_refund.assert_not_called()


def test_legacy_event_projection_does_not_invent_unknown_transaction_ids_or_echo_raw_data():
    from datetime import UTC, datetime
    from decimal import Decimal

    service = OnlinePaymentService(Mock(), Mock(), 1, "legacy-read", lambda _: None, Mock(), None)
    row = {
        "id": 1,
        "paymentId": 1,
        "eventKey": "legacy",
        "providerStatus": "SUCCESS",
        "verifiedPayload": {"demo": True, "authorization": "do-not-echo"},
        "sourceReference": "recorded-reference",
        "sourceAmount": Decimal(1),
        "sourceTransaction": None,
        "sourceTime": None,
        "createdAt": datetime.now(UTC),
        "updatedAt": datetime.now(UTC),
    }
    item = service.project_event(row)
    assert item.verifiedData.providerTransactionId == "" and item.verifiedData.paymentTime is None
    assert item.verifiedData.merchantReference == "recorded-reference"
    assert "do-not-echo" not in item.model_dump_json()
