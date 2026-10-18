from datetime import UTC, date, datetime, timedelta, timezone
from decimal import Decimal, localcontext

import pytest
from pydantic import TypeAdapter, ValidationError

from app.common import schemas as common
from app.common.canonical import canonical_json
from app.common.dates import parse_date, parse_instant, validate_range, vietnam_date
from app.common.values import (
    PATTERNS,
    format_number,
    parse_number,
    rounded_amount,
    validate_fraction,
)
from tests.support.contract import SOURCE, assert_schema

CASES = {
    "Money": ("0", "999999999999999999", "-1"),
    "DerivedSellingPrice": ("0", "1200000000000000000", "-1"),
    "PositiveMoney": ("1", "999999999999999999", "0"),
    "SignedMoney": ("-1", "-999999999999999999", "1000000000000000000"),
    "Quantity": ("0.000", "999999999999999.999", "1.0000"),
    "PositiveQuantity": ("0.001", "999999999999999.999", "0.000"),
    "SignedQuantity": ("-0.001", "-999999999999999.999", "1000000000000000"),
    "NonZeroQuantity": ("-0.001", "999999999999999.999", "-0.000"),
    "PriceRate": ("0.000001", "999.999999", "1000"),
    "Percentage": ("100.0000", "0.0001", "100.0001"),
    "AggregateMoney": ("0", "1" + "0" * 100, "-1"),
    "SignedAggregateMoney": ("-0", "-" + "1" + "0" * 100, "1.1"),
    "AggregateQuantity": ("0.000", "1" + "0" * 100 + ".123", "-1"),
    "SignedAggregateQuantity": ("-0.001", "-" + "1" + "0" * 100 + ".123", "1.1234"),
}


@pytest.mark.parametrize("kind", list(PATTERNS))
def test_exact_numeric_contracts(kind):
    adapter = TypeAdapter(getattr(common, kind))
    assert adapter.json_schema()["pattern"] == SOURCE["components"]["schemas"][kind]["pattern"]
    for value in CASES[kind][:2]:
        number = adapter.validate_python(value)
        assert number == Decimal(value)
        assert_schema(value, kind)
        rendered = adapter.dump_python(number)
        assert_schema(rendered, kind)
        assert Decimal(rendered) == number
        assert adapter.validate_python(number) == number
    for invalid in (CASES[kind][2], "01", "1e2", "NaN", "Infinity", "+1", " 1", 1, 1.0, True, None):
        with pytest.raises(ValidationError):
            adapter.validate_python(invalid)


def test_ids_text_and_output_failures():
    identifier = TypeAdapter(common.Id)
    for value in ("1", "9223372036854775807"):
        assert identifier.validate_python(value) == value
    for value in ("9223372036854775808", "0", "01", 1, True):
        with pytest.raises(ValidationError):
            identifier.validate_python(value)
    catalog = TypeAdapter(common.CatalogId)
    for value in (1, 2147483647):
        assert catalog.validate_python(value) == value
    for value in (0, 2147483648, True, "1", 1.0):
        with pytest.raises(ValidationError):
            catalog.validate_python(value)
    parameter = TypeAdapter(common.CatalogParameter)
    for value in (1, "1", "2147483647"):
        assert parameter.validate_python(value) == int(value)
    for value in ("01", "2147483648", 0, False, "1.0", "-1"):
        with pytest.raises(ValidationError):
            parameter.validate_python(value)
    for value in (Decimal("NaN"), Decimal("1.0001"), Decimal("1000000000000000")):
        with pytest.raises(ValidationError):
            TypeAdapter(common.Quantity).validate_python(value)
    text = TypeAdapter(common.NonEmptyText)
    assert text.validate_python(" x ") == " x "
    assert text.validate_python("x" * 10000)
    for value in ("", " \t", 1):
        with pytest.raises(ValidationError):
            text.validate_python(value)
    for value in (Decimal("NaN"), Decimal("Infinity"), 1):
        with pytest.raises(ValueError):
            format_number(value, kind="Money")
    with pytest.raises(ValueError):
        format_number(Decimal("1.1"), kind="Money")
    assert format_number(Decimal("-0.000"), kind="SignedQuantity") == "0"


def test_exact_arithmetic_and_fraction_policy():
    with localcontext() as context:
        context.prec = 4
        assert rounded_amount(Decimal("600000000000000000"), Decimal(2)) == Decimal(
            "1200000000000000000"
        )
        assert rounded_amount(Decimal("1" + "0" * 100), Decimal("1.5")) == Decimal("15" + "0" * 99)
    assert rounded_amount(Decimal("0.5"), Decimal(1)) == 1
    assert rounded_amount(Decimal("-0.5"), Decimal(1)) == -1
    assert rounded_amount(Decimal("0.000001"), Decimal(1)) == 0
    with pytest.raises(ValueError):
        parse_number("1200000000000000000", kind="Money")
    for left, right in (("NaN", "1"), ("1", "Infinity")):
        with pytest.raises(ValueError):
            rounded_amount(Decimal(left), Decimal(right))
    for number, policy in (("1.0", False), ("1.001", True)):
        assert validate_fraction(Decimal(number), allows_fraction=policy) == Decimal(number)
    for number in ("1.001", "NaN"):
        with pytest.raises(ValueError):
            validate_fraction(Decimal(number), allows_fraction=False)


def test_calendar_instants_and_ranges():
    assert parse_date("2024-02-29") == date(2024, 2, 29)
    assert parse_date(date(2026, 10, 3)) == date(2026, 10, 3)
    for invalid in ("2026-02-29", "20261003", "2026-1-01", datetime.now(UTC), 1):
        with pytest.raises(ValueError):
            parse_date(invalid)
    expected = datetime(2026, 10, 2, 17, tzinfo=UTC)
    assert parse_instant("2026-10-03T00:00:00+07:00") == expected
    assert parse_instant("2026-10-02t17:00:00z") == expected
    assert parse_instant(expected) == expected
    for invalid in (
        datetime(2026, 1, 1),
        "2026-10-03",
        "2026-10-03T00:00:00",
        1,
        "2026-10-03T00:00:00+07:60",
        "2026-10-03T00:00:00+24:00",
    ):
        with pytest.raises(ValueError):
            parse_instant(invalid)
    assert vietnam_date(expected - timedelta(microseconds=1)) == date(2026, 10, 2)
    assert vietnam_date(expected) == date(2026, 10, 3)
    validate_range(None, None)
    validate_range(date(2026, 1, 1), None)
    validate_range(None, date(2026, 1, 1))
    validate_range(date(2026, 1, 1), date(2026, 1, 2))
    for end in (date(2026, 1, 1), date(2025, 1, 1)):
        with pytest.raises(ValueError):
            validate_range(date(2026, 1, 1), end)
    assert (
        TypeAdapter(common.BusinessDate).dump_python(parse_date("2026-01-01"), mode="json")
        == "2026-01-01"
    )
    assert TypeAdapter(common.Instant).validate_python("2026-01-01T00:00:00Z").tzinfo == UTC


def test_canonical_exact_and_rejections():
    assert (
        canonical_json({"b": Decimal("1.00"), "a": [None, True, -1]})
        == b'{"a":[null,true,-1],"b":"1"}'
    )
    assert canonical_json(Decimal("-0.0")) == b'"0"'
    assert canonical_json(date(2026, 1, 1)) == b'"2026-01-01"'
    assert canonical_json(datetime(2026, 1, 1, tzinfo=UTC)) == canonical_json(
        datetime(2026, 1, 1, 7, tzinfo=timezone(timedelta(hours=7)))
    )
    for invalid in (1.0, Decimal("NaN"), {1: "x"}, object(), datetime(2026, 1, 1)):
        with pytest.raises(ValueError):
            canonical_json(invalid)
