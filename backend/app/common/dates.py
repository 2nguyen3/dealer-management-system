import re
from datetime import UTC, date, datetime, timedelta, timezone

# Vietnam has used UTC+07 throughout the supported business history. A fixed
# offset also makes Windows deployments independent of optional zoneinfo data.
VIETNAM = timezone(timedelta(hours=7))


def parse_date(value: object) -> date:
    if type(value) is date:
        return value
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        raise ValueError("Calendar date required")
    return date.fromisoformat(value)


def parse_instant(value: object) -> datetime:
    if isinstance(value, str):
        if not re.fullmatch(
            r"[0-9]{4}-[0-9]{2}-[0-9]{2}[Tt][0-9]{2}:[0-9]{2}:[0-9]{2}"
            r"(?:\.[0-9]+)?(?:[Zz]|[+-][0-9]{2}:[0-9]{2})",
            value,
        ):
            raise ValueError("Aware instant required")
        if value[-1] not in "Zz" and (int(value[-5:-3]) > 23 or int(value[-2:]) > 59):
            raise ValueError("Invalid timezone offset")
        value = datetime.fromisoformat(value.upper())
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Aware instant required")
    return value.astimezone(UTC)


def validate_range[T: (date, datetime)](start: T | None, end: T | None) -> None:
    if start is not None and end is not None and start >= end:
        raise ValueError("Range must have start before end")


def vietnam_date(instant: datetime) -> date:
    return parse_instant(instant).astimezone(VIETNAM).date()
