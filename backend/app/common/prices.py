"""D16 seam between a readable derived quote and a storable issue unit price."""

from decimal import Decimal

from app.common.values import validate_number
from app.core.exceptions import ApiError


def stored_selling_price(quote: Decimal) -> Decimal:
    try:
        return validate_number(quote, kind="PositiveMoney")
    except ValueError:
        raise ApiError(
            409,
            "SELLING_PRICE_UNUSABLE",
            "Current selling-price quote cannot be stored as an issue price",
        ) from None
