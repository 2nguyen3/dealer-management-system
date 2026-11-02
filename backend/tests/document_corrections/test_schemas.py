from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.modules.document_corrections.goods import GoodsCorrectionService
from app.modules.payment_receipts.schemas import PaymentReceiptCorrection
from app.modules.stock_adjustments.schemas import StockAdjustmentCorrection
from app.modules.stock_issues.schemas import StockIssueCorrection
from app.modules.stock_receipts.schemas import StockReceiptCorrection
from tests.support.contract import assert_schema


@pytest.mark.parametrize(
    "model,schema,line",
    [
        (
            StockReceiptCorrection,
            "StockReceiptCorrectionRequest",
            {"productId": "1", "quantity": "1.125", "unitPrice": "100"},
        ),
        (
            StockAdjustmentCorrection,
            "StockAdjustmentCorrectionRequest",
            {"productId": "1", "quantity": "-1.125"},
        ),
    ],
)
def test_full_correction_payload_matches_canonical_schema(model, schema, line):
    body = {"businessDate": "2026-10-01", "reason": "Recorded quantity error", "lines": [line]}
    assert_schema(body, schema)
    parsed = model.model_validate(body)
    assert_schema(parsed.model_dump(mode="json"), schema)
    for invalid in (
        {key: value for key, value in body.items() if key != "reason"},
        {key: value for key, value in body.items() if key != "businessDate"},
        {key: value for key, value in body.items() if key != "lines"},
        {**body, "reason": " "},
        {**body, "lines": []},
        {**body, "agencyId": "2"},
        {**body, "lines": [{**line, "quantity": "0"}]},
        {**body, "lines": [{**line, "quantity": "1.0001"}]},
        {**body, "lines": [{**line, "quantity": 1}]},
    ):
        with pytest.raises(ValidationError):
            model.model_validate(invalid)


def test_goods_coordinator_cannot_be_used_for_cash_or_other_kinds():
    with pytest.raises(ValueError):
        GoodsCorrectionService(SimpleNamespace(), "PAYMENT_RECEIPT")


def test_manual_receipt_correction_has_no_identity_or_online_override():
    body = {
        "businessDate": "2026-01-03",
        "amount": "100",
        "paymentMethod": "CASH",
        "reason": "Bank statement correction",
    }
    for method in ("CASH", "BANK_TRANSFER"):
        parsed = PaymentReceiptCorrection.model_validate({**body, "paymentMethod": method})
        assert_schema(parsed.model_dump(mode="json"), "PaymentReceiptCorrectionRequest")
    for invalid in (
        {**body, "paymentMethod": "ONLINE"},
        {**body, "amount": "0"},
        {**body, "amount": "1.1"},
        {**body, "amount": 100},
        {**body, "agencyId": "2"},
        {**body, "receiptType": "RECEIVED_UNAPPLIED"},
        {**body, "reason": " "},
        {key: value for key, value in body.items() if key != "amount"},
    ):
        with pytest.raises(ValidationError):
            PaymentReceiptCorrection.model_validate(invalid)


def test_issue_correction_omitted_prices_preserve_snapshots_and_null_is_not_an_override():
    body = {
        "businessDate": "2026-01-02",
        "reason": "Wrong quantity",
        "lines": [{"productId": "1", "quantity": "2"}],
    }
    parsed = StockIssueCorrection.model_validate(body)
    assert_schema(parsed.model_dump(mode="json", exclude_none=True), "StockIssueCorrectionRequest")
    assert parsed.sellingPriceRate is None and parsed.lines[0].basePurchasePrice is None
    changed = StockIssueCorrection.model_validate(
        {
            **body,
            "sellingPriceRate": "1.25",
            "lines": [{**body["lines"][0], "basePurchasePrice": "100"}],
        }
    )
    assert_schema(changed.model_dump(mode="json", exclude_none=True), "StockIssueCorrectionRequest")
    for invalid in (
        {**body, "sellingPriceRate": None},
        {**body, "lines": [{**body["lines"][0], "basePurchasePrice": None}]},
        {**body, "immediatePayment": "0"},
        {**body, "lines": []},
    ):
        with pytest.raises(ValidationError):
            StockIssueCorrection.model_validate(invalid)
