from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.common.schemas import Error, FieldError
from app.core.exceptions import ApiError, AuthError

ERROR_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["code", "message", "requestId"],
    "properties": {
        "code": {"type": "string", "minLength": 1, "pattern": r"\S"},
        "message": {"type": "string", "minLength": 1, "pattern": r"\S"},
        "requestId": {"type": "string", "minLength": 1, "pattern": r"\S"},
        "fieldErrors": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["field", "code", "message"],
                "properties": {
                    "field": {"type": "string"},
                    "code": {"type": "string"},
                    "message": {"type": "string"},
                },
            },
        },
        "details": {"type": "object", "additionalProperties": True},
    },
}


def business_path(request: Request) -> bool:
    return request.url.path.startswith("/api/v1/") and not request.url.path.startswith(
        ("/api/v1/auth/", "/api/v1/health")
    )


def api_error_response(request: Request, error: ApiError) -> JSONResponse:
    headers = {**error.headers, "X-Request-Id": request.state.request_id}
    if error.status == 401:
        headers["WWW-Authenticate"] = "Bearer"
    return JSONResponse(
        status_code=error.status,
        headers=headers,
        content=Error(
            code=error.code,
            message=error.message,
            requestId=request.state.request_id,
            fieldErrors=error.fields,
            details=error.details,
        ).model_dump(exclude_none=True),
    )


async def api_error_handler(request: Request, error: ApiError) -> JSONResponse:
    return api_error_response(request, error)


def field_pointer(location: tuple) -> str:
    if location[0] == "body":
        return "/" + "/".join(
            str(part).replace("~", "~0").replace("/", "~1") for part in location[1:]
        )
    return ".".join(str(part) for part in location)


def auth_error_response(request: Request, error: AuthError) -> JSONResponse:
    headers = {"Cache-Control": "no-store", "X-Request-Id": request.state.request_id}
    if error.status == 401:
        headers["WWW-Authenticate"] = "Bearer"
    if error.retry_after is not None:
        headers["Retry-After"] = str(error.retry_after)
    return JSONResponse(
        status_code=error.status,
        headers=headers,
        content={
            "code": error.code,
            "message": error.message,
            "requestId": request.state.request_id,
        },
    )


async def auth_error_handler(request: Request, error: AuthError) -> JSONResponse:
    return auth_error_response(request, error)


async def http_error_handler(request: Request, error: HTTPException) -> JSONResponse:
    if business_path(request):
        return api_error_response(
            request,
            ApiError(
                error.status_code, "BAD_REQUEST", "Invalid HTTP request", headers=error.headers
            ),
        )
    if not request.url.path.startswith("/api/v1/auth/"):
        from fastapi.exception_handlers import http_exception_handler

        return await http_exception_handler(request, error)
    return auth_error_response(
        request, AuthError(error.status_code, "BAD_REQUEST", "Invalid HTTP request")
    )


async def validation_error_handler(request: Request, error: RequestValidationError) -> JSONResponse:
    if business_path(request):
        malformed = any(item["type"] == "json_invalid" for item in error.errors())
        if any(
            item["type"] == "missing" and tuple(item["loc"]) == ("header", "If-Match")
            for item in error.errors()
        ):
            return api_error_response(
                request,
                ApiError(428, "PRECONDITION_REQUIRED", "A resource precondition is required"),
            )
        fields = [
            FieldError(
                field=field_pointer(tuple(item["loc"])),
                code="INVALID_FIELD",
                message="Invalid request field",
            )
            for item in error.errors()
            if item["type"] != "extra_forbidden"
        ]
        return api_error_response(
            request,
            ApiError(
                400 if malformed else 422,
                "MALFORMED_REQUEST" if malformed else "VALIDATION_FAILED",
                "Malformed JSON" if malformed else "Invalid request fields",
                fields=None if malformed else fields,
            ),
        )
    if not request.url.path.startswith("/api/v1/auth/"):
        from fastapi.exception_handlers import request_validation_exception_handler

        return await request_validation_exception_handler(request, error)
    malformed = any(item["type"] == "json_invalid" for item in error.errors())
    return auth_error_response(
        request,
        AuthError(
            400 if malformed else 422,
            "MALFORMED_REQUEST" if malformed else "VALIDATION_FAILED",
            "Malformed JSON" if malformed else "Invalid request fields",
        ),
    )
