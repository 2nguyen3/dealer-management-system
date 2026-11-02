from datetime import date, datetime
from decimal import Decimal
from functools import partial
from typing import Annotated, Any

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    PlainSerializer,
    PlainValidator,
    WithJsonSchema,
)

from app.common.dates import parse_date, parse_instant
from app.common.values import (
    PATTERNS,
    format_number,
    parse_catalog_parameter,
    validate_id,
    validate_number,
)


def numeric_alias(kind: str) -> Any:
    return Annotated[
        Decimal,
        PlainValidator(partial(validate_number, kind=kind)),
        PlainSerializer(partial(format_number, kind=kind), return_type=str),
        WithJsonSchema({"type": "string", "pattern": PATTERNS[kind]}),
    ]


Id = Annotated[str, Field(strict=True, pattern=r"^[1-9][0-9]{0,18}$"), AfterValidator(validate_id)]
CatalogId = Annotated[int, Field(strict=True, ge=1, le=2147483647)]
CatalogParameter = Annotated[CatalogId, BeforeValidator(parse_catalog_parameter)]
NonEmptyText = Annotated[str, Field(strict=True, min_length=1, pattern=r"\S")]
Limit = Annotated[int, Field(ge=1, le=100)]
Cursor = Annotated[str, Field(min_length=1)]
Money = numeric_alias("Money")
DerivedSellingPrice = numeric_alias("DerivedSellingPrice")
PositiveMoney = numeric_alias("PositiveMoney")
SignedMoney = numeric_alias("SignedMoney")
Quantity = numeric_alias("Quantity")
PositiveQuantity = numeric_alias("PositiveQuantity")
SignedQuantity = numeric_alias("SignedQuantity")
NonZeroQuantity = numeric_alias("NonZeroQuantity")
PriceRate = numeric_alias("PriceRate")
Percentage = numeric_alias("Percentage")
AggregateMoney = numeric_alias("AggregateMoney")
SignedAggregateMoney = numeric_alias("SignedAggregateMoney")
AggregateQuantity = numeric_alias("AggregateQuantity")
SignedAggregateQuantity = numeric_alias("SignedAggregateQuantity")
BusinessDate = Annotated[
    date,
    PlainValidator(parse_date),
    PlainSerializer(date.isoformat, return_type=str),
    WithJsonSchema({"type": "string", "format": "date"}),
]
Instant = Annotated[
    datetime,
    PlainValidator(parse_instant),
    PlainSerializer(datetime.isoformat, return_type=str),
    WithJsonSchema({"type": "string", "format": "date-time"}),
]
NullableText = Annotated[str | None, WithJsonSchema({"type": ["string", "null"]})]
NullableInstant = Annotated[
    Instant | None, WithJsonSchema({"type": ["string", "null"], "format": "date-time"})
]


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class FieldError(ApiModel):
    field: str
    code: str
    message: str


class Error(ApiModel):
    code: NonEmptyText
    message: NonEmptyText
    requestId: NonEmptyText
    fieldErrors: list[FieldError] | None = None
    details: dict | None = None


class Pagination(ApiModel):
    limit: Limit
    hasMore: bool
    nextCursor: Annotated[str | None, WithJsonSchema({"type": ["string", "null"]})]
