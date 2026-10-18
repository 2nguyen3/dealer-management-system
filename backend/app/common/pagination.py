import base64
import binascii
import hashlib
import hmac
import json
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import and_, or_
from sqlalchemy.sql.elements import ColumnElement

from app.common.canonical import canonical_json
from app.common.dates import parse_date, parse_instant
from app.common.schemas import Pagination
from app.core.exceptions import ApiError


def cursor_error() -> ApiError:
    return ApiError(400, "INVALID_CURSOR", "Invalid pagination cursor")


def decode_key(value: object, expected: type) -> object:
    if expected in (str, int) and type(value) is expected:
        return value
    if expected is Decimal and isinstance(value, str):
        parsed = Decimal(value)
        if parsed.is_finite():
            return parsed
    if expected is date:
        return parse_date(value)
    if expected is datetime:
        return parse_instant(value)
    raise ValueError("Invalid cursor key type")


class CursorCodec:
    def __init__(self, master_key: bytes) -> None:
        if len(master_key) < 32:
            raise ValueError("Cursor master key must contain at least 32 bytes")
        self.key = hmac.digest(master_key, b"agentra:cursor:v1", "sha256")

    def encode(self, scope: object, values: Sequence[object]) -> str:
        payload = canonical_json(
            {"v": 1, "scope": hashlib.sha256(canonical_json(scope)).hexdigest(), "keys": values}
        )
        raw = payload + hmac.digest(self.key, payload, "sha256")
        encoded = base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")
        if len(encoded) > 8192:
            raise ValueError("Cursor exceeds supported size")
        return encoded

    def decode(self, token: str, scope: object, types: Sequence[type]) -> tuple[object, ...]:
        try:
            if not token or len(token) > 8192:
                raise ValueError("Invalid cursor size")
            raw = base64.b64decode(token + "=" * (-len(token) % 4), altchars=b"-_", validate=True)
            payload, signature = raw[:-32], raw[-32:]
            if not hmac.compare_digest(signature, hmac.digest(self.key, payload, "sha256")):
                raise ValueError("Invalid signature")
            data = json.loads(payload)
            if (
                not isinstance(data, dict)
                or set(data) != {"v", "scope", "keys"}
                or type(data["v"]) is not int
                or data["v"] != 1
                or data["scope"] != hashlib.sha256(canonical_json(scope)).hexdigest()
                or not isinstance(data["keys"], list)
                or len(data["keys"]) != len(types)
            ):
                raise ValueError("Invalid cursor scope/shape")
            return tuple(
                decode_key(value, kind) for value, kind in zip(data["keys"], types, strict=True)
            )
        except (ValueError, TypeError, UnicodeError, binascii.Error, ArithmeticError):
            raise cursor_error() from None


@dataclass(frozen=True)
class SortSpec:
    fields: tuple[str, ...]
    descending: bool

    @classmethod
    def parse(cls, value: str, registry: Mapping[str, tuple[str, ...]]) -> "SortSpec":
        if value not in registry:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid sort field")
        return cls(registry[value], value.startswith("-"))

    def ordering(self, columns: Mapping[str, ColumnElement]) -> list[ColumnElement]:
        return [
            columns[field].desc() if self.descending else columns[field].asc()
            for field in self.fields
        ]

    def after(
        self, columns: Mapping[str, ColumnElement], values: Sequence[object]
    ) -> ColumnElement:
        if len(values) != len(self.fields) or any(value is None for value in values):
            raise cursor_error()
        legs = []
        for index, field in enumerate(self.fields):
            column = columns[field]
            comparison = column < values[index] if self.descending else column > values[index]
            legs.append(
                and_(
                    *(columns[name] == values[i] for i, name in enumerate(self.fields[:index])),
                    comparison,
                )
            )
        return or_(*legs)


def literal_search(value: str) -> str:
    value = value.strip()
    if not value:
        raise ApiError(422, "VALIDATION_FAILED", "Search must not be blank")
    return "%" + value.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_") + "%"


def build_page[T](
    rows: Sequence[T],
    limit: int,
    codec: CursorCodec,
    scope: object,
    keys: Callable[[T], Sequence[object]],
) -> tuple[list[T], Pagination]:
    if type(limit) is not int or not 1 <= limit <= 100:
        raise ApiError(422, "VALIDATION_FAILED", "Invalid page limit")
    items = list(rows[:limit])
    more = len(rows) > limit
    return items, Pagination(
        limit=limit,
        hasMore=more,
        nextCursor=codec.encode(scope, keys(items[-1])) if more else None,
    )
