import re
from decimal import ROUND_HALF_UP, Decimal, localcontext

PATTERNS = {
    "Money": r"^(0|[1-9][0-9]{0,17})$",
    "PositiveMoney": r"^[1-9][0-9]{0,17}$",
    "SignedMoney": r"^-?(0|[1-9][0-9]{0,17})$",
    "Quantity": r"^(0|[1-9][0-9]{0,14})(\.[0-9]{1,3})?$",
    "PositiveQuantity": r"^(?!0(?:\.0{1,3})?$)(0|[1-9][0-9]{0,14})(\.[0-9]{1,3})?$",
    "SignedQuantity": r"^-?(0|[1-9][0-9]{0,14})(\.[0-9]{1,3})?$",
    "NonZeroQuantity": r"^(?!-?0(?:\.0{1,3})?$)-?(0|[1-9][0-9]{0,14})(\.[0-9]{1,3})?$",
    "PriceRate": r"^(?!0(?:\.0{1,6})?$)(0|[1-9][0-9]{0,2})(\.[0-9]{1,6})?$",
    "Percentage": r"^(?:(?:0|[1-9][0-9]?)(?:\.[0-9]{1,4})?|100(?:\.0{1,4})?)$",
    "AggregateMoney": r"^(0|[1-9][0-9]*)$",
    "DerivedSellingPrice": r"^(0|[1-9][0-9]*)$",
    "SignedAggregateMoney": r"^-?(0|[1-9][0-9]*)$",
    "AggregateQuantity": r"^(0|[1-9][0-9]*)(\.[0-9]{1,3})?$",
    "SignedAggregateQuantity": r"^-?(0|[1-9][0-9]*)(\.[0-9]{1,3})?$",
}


def parse_number(value: object, *, kind: str) -> Decimal:
    if not isinstance(value, str) or not re.fullmatch(PATTERNS[kind], value):
        raise ValueError("Invalid exact numeric string")
    return Decimal(value)


def format_number(value: Decimal, *, kind: str) -> str:
    if not isinstance(value, Decimal) or not value.is_finite():
        raise ValueError("Invalid exact number")
    rendered = format(value, "f")
    if "." in rendered:
        rendered = rendered.rstrip("0").rstrip(".")
    if value.is_zero():
        rendered = "0"
    parse_number(rendered, kind=kind)
    return rendered


def validate_number(value: object, *, kind: str) -> Decimal:
    # Native Decimal values come from SQLAlchemy or domain computations; JSON
    # numbers remain forbidden. Validate storage precision/range without rounding.
    if isinstance(value, Decimal):
        format_number(value, kind=kind)
        return value
    return parse_number(value, kind=kind)


def parse_catalog_parameter(value: object) -> int:
    if type(value) is int:
        return value
    if isinstance(value, str) and re.fullmatch(r"[1-9][0-9]{0,9}", value):
        return int(value)
    raise ValueError("Invalid catalogue parameter")


def validate_id(value: str) -> str:
    if int(value) > 9223372036854775807:
        raise ValueError("ID exceeds BIGINT range")
    return value


def rounded_amount(quantity: Decimal, unit_price: Decimal) -> Decimal:
    """Exact derived multiplication; storage bounds are checked by its caller."""
    if not quantity.is_finite() or not unit_price.is_finite():
        raise ValueError("Finite operands required")
    with localcontext() as context:
        context.prec = max(
            50,
            len(quantity.as_tuple().digits)
            + len(unit_price.as_tuple().digits)
            + max(0, quantity.adjusted() + unit_price.adjusted())
            + 4,
        )
        return (quantity * unit_price).quantize(Decimal(1), rounding=ROUND_HALF_UP)


def validate_fraction(quantity: Decimal, *, allows_fraction: bool) -> Decimal:
    if not quantity.is_finite() or (
        not allows_fraction and quantity != quantity.to_integral_value()
    ):
        raise ValueError("Fraction not allowed for this unit")
    return quantity
