from decimal import Decimal

import pytest

from app.common.prices import stored_selling_price
from app.common.schemas import ApiModel, DerivedSellingPrice
from app.core.exceptions import ApiError


class Quote(ApiModel):
    price: DerivedSellingPrice


def test_d16_readable_quotes_and_stored_price_boundary():
    for price in ("0", "1200000000000000000"):
        assert Quote(price=price).model_dump(mode="json") == {"price": price}
        with pytest.raises(ApiError) as error:
            stored_selling_price(Decimal(price))
        assert error.value.status == 409 and error.value.code == "SELLING_PRICE_UNUSABLE"
    assert stored_selling_price(Decimal("999999999999999999")) == Decimal("999999999999999999")
    assert stored_selling_price(Decimal(1)) == 1
    for price in ("1.5", "NaN", "-1"):
        with pytest.raises(ApiError):
            stored_selling_price(Decimal(price))
