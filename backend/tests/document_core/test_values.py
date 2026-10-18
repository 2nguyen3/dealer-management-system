from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.common.pagination import CursorCodec
from app.core.exceptions import ApiError, AuthError
from app.modules.document_core.batches import reversal_values
from app.modules.document_core.schemas import DraftLine
from app.modules.document_core.service import DocumentService, exact_total, line_amount


def test_totals_use_per_line_whole_vnd_and_preserve_wide_precision():
    assert exact_total([]) == 0
    assert exact_total([Decimal("999999999999999999")]) == Decimal("999999999999999999")
    line = DraftLine(
        kind="STOCK_RECEIPT", productId="9007199254740993", quantity="0.005", unitPrice="100"
    )
    assert line_amount(line) == 1
    assert exact_total([line_amount(line), line_amount(line)]) == 2
    wide = line.model_copy(
        update={
            "quantity": Decimal("999999999999999.999"),
            "unitPrice": Decimal("999999999999999999"),
        }
    )
    assert line_amount(wide) == Decimal("999999999999999998000000000000000")
    with pytest.raises(ApiError, match="TOTAL_OVERFLOW"):
        exact_total([line_amount(wide)])
    returned = line.model_copy(update={"kind": "SALES_RETURN", "returnAmount": Decimal(0)})
    assert line_amount(returned) == 0


@pytest.mark.parametrize(
    "values",
    [
        {"productId": 1},
        {"quantity": "0"},
        {"quantity": "0.0001"},
        {"unitPrice": "1.1"},
        {"unitPrice": 100},
        {"quantity": True},
    ],
)
def test_prepared_line_input_rejects_inexact_or_invalid_values(values):
    with pytest.raises(ValidationError):
        DraftLine.model_validate(
            {"kind": "STOCK_RECEIPT", "productId": "1", "quantity": "1", "unitPrice": "1", **values}
        )


def test_reversal_preserves_source_and_exact_negative_value():
    original = {
        "id": 1,
        "batchId": 2,
        "lineId": 3,
        "productId": 4,
        "unitId": 5,
        "quantity": Decimal("-0.125"),
        "businessDate": "2026-10-01",
        "businessOrder": 6,
        "reversesEntryId": None,
        "isEffective": True,
        "createdAt": "ignored",
        "updatedAt": "ignored",
    }
    result = reversal_values(original, 7, value_field="quantity")
    assert result == {
        "batchId": 7,
        "lineId": 3,
        "productId": 4,
        "unitId": 5,
        "quantity": Decimal("0.125"),
        "businessDate": "2026-10-01",
        "businessOrder": 6,
        "reversesEntryId": 1,
    }
    assert original["quantity"] == Decimal("-0.125")
    for invalid in ({"reversesEntryId": 9}, {"isEffective": False}):
        with pytest.raises(ApiError) as error:
            reversal_values({**original, **invalid}, 7, value_field="quantity")
        assert error.value.code == "REVERSAL_CONFLICT"
    with pytest.raises(ValueError):
        reversal_values(original, 7, value_field="unitId")
    cash = {
        "id": 1,
        "amount": Decimal("9007199254740993"),
        "reversesEntryId": None,
        "isEffective": True,
    }
    assert reversal_values(cash, 7, value_field="amount")["amount"] == Decimal("-9007199254740993")


@pytest.mark.parametrize(
    "status,code", [(401, "INVALID_OR_EXPIRED_TOKEN"), (403, "ACCOUNT_LOCKED")]
)
def test_any_of_reads_preserve_authentication_errors(status, code):
    failure = AuthError(status, code, "Session is unavailable")

    def authorize(required):
        raise failure

    core = DocumentService(None, CursorCodec(b"x" * 32), 1, "auth-boundary", authorize)
    with pytest.raises(AuthError) as error:
        core.authorize_read("STOCK_RECEIPT")
    assert error.value is failure
