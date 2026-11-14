"""Shared translation of PostgreSQL errors into API errors (services own transactions)."""

from collections.abc import Mapping

from sqlalchemy.exc import DBAPIError

from app.core.exceptions import ApiError


def translate_database_error(
    error: DBAPIError, conflicts: Mapping[tuple[str, str | None], tuple[str, str]]
) -> ApiError:
    state = getattr(error.orig, "sqlstate", None)
    constraint = getattr(getattr(error.orig, "diag", None), "constraint_name", None)
    mapped = conflicts.get((state, constraint))
    if mapped is not None:
        return ApiError(409, mapped[0], mapped[1])
    if state in ("55P03", "40001", "40P01"):
        return ApiError(409, "RESOURCE_BUSY", "Resource is busy; retry the same intent")
    return ApiError(500, "INTERNAL_ERROR", "Internal server error")
