import json
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from app.common.dates import parse_instant


def canonical_value(value: object) -> object:
    if value is None or type(value) in (str, int, bool):
        return value
    if isinstance(value, Decimal):
        if not value.is_finite():
            raise ValueError("Nonfinite canonical value")
        rendered = format(value, "f")
        if "." in rendered:
            rendered = rendered.rstrip("0").rstrip(".")
        return "0" if value.is_zero() else rendered
    if isinstance(value, datetime):
        return parse_instant(value).isoformat()
    if isinstance(value, (date, UUID)):
        return str(value)
    if isinstance(value, (list, tuple)):
        return [canonical_value(item) for item in value]
    if isinstance(value, dict) and all(isinstance(key, str) for key in value):
        return {key: canonical_value(item) for key, item in value.items()}
    raise ValueError("Unsupported canonical value; floats are forbidden")


def canonical_json(value: object) -> bytes:
    return json.dumps(
        canonical_value(value), sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
