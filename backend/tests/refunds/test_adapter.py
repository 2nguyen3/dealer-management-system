import httpx
import pytest
from pydantic import SecretStr, ValidationError

from app.core.exceptions import ApiError
from app.modules.online_payments.adapter import SandboxAdapter
from app.modules.refunds.schemas import RefundCreate, RefundUpdate, VerifiedRefund


def test_refund_adapter_canonical_identity_and_definitive_absence():
    def handler(request):
        if request.url.path == "/refunds/query":
            return httpx.Response(
                404,
                json={
                    "code": "REFERENCE_NOT_FOUND",
                    "definitive": True,
                    "merchantRefundReference": "reference",
                },
            )
        return httpx.Response(
            200, json={"merchantRefundReference": "reference", "amount": "1", "state": "UNKNOWN"}
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        adapter = SandboxAdapter(
            "https://controlled.test",
            SecretStr("synthetic"),
            "https://callback.test",
            client=client,
        )
        evidence = adapter.request_refund("reference", "payment", 1)
        assert evidence.state == "UNKNOWN"
        assert evidence.model_dump(mode="json")["completedAt"] is None
        with pytest.raises(ApiError, match="PROVIDER_REFERENCE_NOT_FOUND"):
            adapter.query_refund("reference")


def test_refund_schema_boundaries_and_terminal_evidence():
    for value in ("0", 1, "1.1", "1000000000000000000"):
        with pytest.raises(ValidationError):
            RefundCreate(
                originDocumentId="1", businessDate="2026-01-01", amount=value, paymentMethod="CASH"
            )
    for body in ({}, {"amount": None}, {"originDocumentId": "2"}):
        with pytest.raises(ValidationError):
            RefundUpdate.model_validate(body)
    with pytest.raises(ValidationError):
        VerifiedRefund(merchantRefundReference="r", amount="1", state="FAILED")
    with pytest.raises(ValidationError):
        VerifiedRefund(
            merchantRefundReference="r",
            amount="1",
            state="SUCCESS",
            completedAt="2026-01-01T00:00:00Z",
        )
    assert (
        VerifiedRefund(
            merchantRefundReference="r",
            amount="1",
            state="SUCCESS",
            providerRefundId="f",
            completedAt="2026-01-01T00:00:00Z",
        ).state
        == "SUCCESS"
    )


@pytest.mark.parametrize(
    "body",
    [
        {"error": "route not found"},
        {"code": "REFERENCE_NOT_FOUND", "definitive": True, "merchantRefundReference": "different"},
    ],
)
def test_unverified_or_mismatched_404_is_not_absence_proof(body):
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(404, json=body))
    ) as client:
        adapter = SandboxAdapter(
            "https://controlled.test",
            SecretStr("synthetic"),
            "https://callback.test",
            client=client,
        )
        with pytest.raises(ApiError, match="INVALID_PROVIDER_RESPONSE"):
            adapter.query_refund("reference")
