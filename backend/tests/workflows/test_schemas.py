from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.core.exceptions import AuthError
from app.modules.document_core.financial import authorize_any
from app.modules.payment_receipts.schemas import PaymentReceiptCreate, PaymentReceiptUpdate
from app.modules.stock_issues.schemas import (
    PendingIssueRevision,
    StockIssueCreate,
    StockIssueUpdate,
)
from app.modules.upfront_payments.schemas import UpfrontCreate


@pytest.mark.parametrize(
    "model,base,invalid",
    [
        (StockIssueCreate, {"agencyId": "1", "businessDate": "2026-01-02"}, invalid)
        for invalid in (
            {"agencyId": 1},
            {"agencyId": "0"},
            {"businessDate": "2026-02-30"},
            {"immediatePayment": 1},
            {"immediatePayment": "-1"},
            {"immediatePayment": "0.1"},
            {"lines": [{"productId": "1", "quantity": "0"}]},
            {"lines": [{"productId": "1", "quantity": "1", "unitPrice": "10"}]},
        )
    ]
    + [
        (
            PaymentReceiptCreate,
            {"agencyId": "1", "businessDate": "2026-01-02", "amount": "1", "paymentMethod": "CASH"},
            invalid,
        )
        for invalid in (
            {"amount": "0"},
            {"amount": "1000000000000000000"},
            {"amount": None},
            {"paymentMethod": "ONLINE"},
            {"receiptType": "AUTO_FROM_ISSUE"},
            {"allocations": []},
        )
    ]
    + [
        (
            UpfrontCreate,
            {
                "issueRevisionId": "1",
                "amount": "1",
                "method": "CASH",
                "receivedAt": "2026-01-01T17:00:00Z",
            },
            invalid,
        )
        for invalid in (
            {"receivedAt": "2026-01-01T17:00:00"},
            {"amount": "0"},
            {"method": "ONLINE"},
            {"evidenceReference": None},
            {"evidenceReference": " "},
            {"issueRevisionId": 1},
        )
    ],
)
def test_strict_workflow_inputs_reject_invalid_values(model, base, invalid):
    with pytest.raises(ValidationError):
        model.model_validate({**base, **invalid})


@pytest.mark.parametrize("model", [StockIssueUpdate, PaymentReceiptUpdate])
@pytest.mark.parametrize("body", [{}, {"agencyId": "2"}, {"businessDate": None}, {"note": 1}])
def test_patch_boundary_and_immutable_agency(model, body):
    with pytest.raises(ValidationError):
        model.model_validate(body)


def test_draft_defaults_and_full_replacement_requirements_are_exact():
    issue = StockIssueCreate(agencyId="1", businessDate="2026-01-02")
    assert issue.immediatePayment == Decimal(0) and issue.lines == []
    assert issue.model_dump(mode="json")["immediatePayment"] == "0"
    valid = {
        "businessDate": "2026-01-02",
        "reason": "Replace",
        "immediatePayment": "0",
        "lines": [{"productId": "1", "quantity": "1.001"}],
    }
    assert PendingIssueRevision.model_validate(valid).lines[0].quantity == Decimal("1.001")
    for body in (
        {**valid, "lines": []},
        {**valid, "reason": " "},
        {key: value for key, value in valid.items() if key != "immediatePayment"},
    ):
        with pytest.raises(ValidationError):
            PendingIssueRevision.model_validate(body)


def test_any_permission_checks_retain_account_errors_and_accept_each_reader():
    for selected in ("one", "two", "three"):

        def authorize(required, selected=selected):
            if required != (selected,):
                raise AuthError(403, "FORBIDDEN", "Denied")

        authorize_any(authorize, ("one", "two", "three"))

    def denied(required):
        raise AuthError(403, "FORBIDDEN", "Denied")

    with pytest.raises(AuthError, match="FORBIDDEN"):
        authorize_any(denied, ("one",))

    def locked(required):
        raise AuthError(403, "ACCOUNT_LOCKED", "Locked")

    with pytest.raises(AuthError, match="ACCOUNT_LOCKED"):
        authorize_any(locked, ("one",))
