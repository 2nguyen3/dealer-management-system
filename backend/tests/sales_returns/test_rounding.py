from decimal import Decimal

import pytest

from app.core.exceptions import ApiError
from app.modules.sales_returns.rounding import cumulative_amounts


def test_whole_vnd_cumulative_rounding_preserves_zero_increment():
    sold = {1: {"quantity": Decimal(1), "unitPrice": Decimal(1), "unitId": 1}}
    events = [
        {
            "id": index,
            "productId": 1,
            "quantity": Decimal(".5"),
            "unitPrice": Decimal(1),
            "unitId": 1,
        }
        for index in (11, 12)
    ]
    assert cumulative_amounts(events, sold) == {11: Decimal(1), 12: Decimal(0)}
    assert cumulative_amounts([], sold) == {}


@pytest.mark.parametrize(
    "field,value,code",
    [
        ("productId", 2, "RETURN_SOURCE_CONFLICT"),
        ("unitPrice", Decimal(2), "RETURN_SOURCE_CONFLICT"),
        ("unitId", 2, "RETURN_SOURCE_CONFLICT"),
        ("quantity", Decimal(0), "RETURN_QUANTITY_CONFLICT"),
        ("quantity", Decimal(2), "RETURN_QUANTITY_CONFLICT"),
    ],
)
def test_return_source_and_cap_failures(field, value, code):
    sold = {1: {"quantity": Decimal(1), "unitPrice": Decimal(1), "unitId": 1}}
    event = {
        "id": 1,
        "productId": 1,
        "quantity": Decimal(1),
        "unitPrice": Decimal(1),
        "unitId": 1,
        field: value,
    }
    with pytest.raises(ApiError) as error:
        cumulative_amounts([event], sold)
    assert error.value.code == code
