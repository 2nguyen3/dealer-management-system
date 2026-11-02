import hashlib
import re
from dataclasses import dataclass

from fastapi import Request

from app.common.canonical import canonical_json
from app.core.exceptions import ApiError


def canonical_etag(resource: str, projection: object) -> str:
    digest = hashlib.sha256(canonical_json(["detail-v1", resource, projection])).hexdigest()
    return f'"v1-{digest}"'


@dataclass(frozen=True)
class Preconditions:
    match: str | None
    create_only: bool = False

    def compare(self, current: str | None) -> None:
        if (self.create_only and current is not None) or (
            not self.create_only and self.match != current
        ):
            raise ApiError(
                412,
                "PRECONDITION_FAILED",
                "Resource version has changed",
                headers={} if current is None else {"ETag": current},
            )


def parse_preconditions(
    match: str | None, none_match: str | None = None, *, allow_create: bool = False
) -> Preconditions:
    if match is None and none_match is None:
        raise ApiError(428, "PRECONDITION_REQUIRED", "A resource precondition is required")
    if match is not None and none_match is not None:
        raise ApiError(422, "VALIDATION_FAILED", "Precondition headers are mutually exclusive")
    if none_match is not None:
        if not allow_create or none_match != "*":
            raise ApiError(422, "VALIDATION_FAILED", "Invalid create precondition")
        return Preconditions(None, True)
    if not re.fullmatch(r'"[\x21\x23-\x7e]+"', match or "") or "," in (match or ""):
        raise ApiError(422, "VALIDATION_FAILED", "A single strong ETag is required")
    return Preconditions(match)


def read_preconditions(request: Request, *, allow_create: bool = False) -> Preconditions:
    matches = request.headers.getlist("if-match")
    none_matches = request.headers.getlist("if-none-match")
    if len(matches) > 1 or len(none_matches) > 1:
        raise ApiError(422, "VALIDATION_FAILED", "A single precondition header is required")
    return parse_preconditions(
        matches[0] if matches else None,
        none_matches[0] if none_matches else None,
        allow_create=allow_create,
    )
