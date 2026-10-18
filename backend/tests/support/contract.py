import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

SOURCE = json.loads(
    (Path(__file__).parents[3] / "openwiki/backend-design/API/openapi.json").read_text(
        encoding="utf-8"
    )
)


def resolve(reference: dict) -> dict:
    if "$ref" not in reference:
        return reference
    target = SOURCE
    for part in reference["$ref"][2:].split("/"):
        target = target[part]
    return resolve(target)


def assert_schema(value: object, name: str) -> None:
    checker = FormatChecker()
    if "date-time" not in checker.checkers:
        raise RuntimeError("Source contract verification requires the RFC3339 date-time checker")
    Draft202012Validator(SOURCE, format_checker=checker).evolve(
        schema={"$ref": f"#/components/schemas/{name}"}
    ).validate(value)


def transport_matrix() -> list[dict]:
    matrix = []
    for path, methods in SOURCE["paths"].items():
        for method, operation in methods.items():
            if method not in ("get", "post", "put", "patch", "delete"):
                continue
            parameters = [
                resolve(item)
                for item in methods.get("parameters", []) + operation.get("parameters", [])
            ]
            matrix.append(
                {
                    "operationId": operation["operationId"],
                    "method": method.upper(),
                    "path": path,
                    "bodyRequired": resolve(operation.get("requestBody", {})).get(
                        "required", False
                    ),
                    "security": operation.get("security", SOURCE.get("security")),
                    "permissions": operation.get("x-permissions"),
                    "headers": [p for p in parameters if p["in"] == "header"],
                    "responses": {
                        key: resolve(value) for key, value in operation["responses"].items()
                    },
                }
            )
    return matrix
