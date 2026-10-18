from collections import defaultdict
from decimal import Decimal, localcontext

from app.common.values import rounded_amount
from app.core.exceptions import ApiError


def cumulative_amounts(events, sold):
    """Ordered immutable line events -> per-line amounts; never round increments alone."""
    quantities, amounts, result = defaultdict(Decimal), defaultdict(Decimal), {}
    with localcontext() as context:
        context.prec = 80
        for event in events:
            product = event["productId"]
            source = sold.get(product)
            if (
                source is None
                or event["unitPrice"] != source["unitPrice"]
                or event["unitId"] != source["unitId"]
            ):
                raise ApiError(
                    409, "RETURN_SOURCE_CONFLICT", "Return differs from current original sale"
                )
            if event["quantity"] <= 0:
                raise ApiError(409, "RETURN_QUANTITY_CONFLICT", "Return quantity must be positive")
            quantities[product] += event["quantity"]
            if quantities[product] > source["quantity"]:
                raise ApiError(
                    409, "RETURN_QUANTITY_CONFLICT", "Cumulative return exceeds sold quantity"
                )
            total = rounded_amount(quantities[product], source["unitPrice"])
            result[event["id"]] = total - amounts[product]
            amounts[product] = total
    return result
