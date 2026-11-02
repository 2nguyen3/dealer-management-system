from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Request, Response
from fastapi.routing import APIRoute

from app.core.exceptions import ApiError


class BusinessRoute(APIRoute):
    """Validate JSON only for modeled bodies; raw signed webhooks opt out."""

    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        if self.body_field is not None and (self.openapi_extra or {}).get("x-raw-body", False):
            raise ValueError("Signed raw-body routes must read Request bytes before parsing")
        handler = super().get_route_handler()

        async def transport(request: Request) -> Response:
            if self.body_field is not None:
                media = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
                if media != "application/json":
                    raise ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "JSON content type required")
            return await handler(request)

        return transport


def matched_operation(request: Request) -> str | None:
    route = request.scope.get("route")
    if isinstance(route, APIRoute):
        return route.operation_id or route.unique_id
    return None
