import pytest

from tests.auth.test_http import assert_schema_constraints
from tests.support.contract import SOURCE, resolve

pytestmark = pytest.mark.integration


def test_inventory_runtime_matches_the_single_canonical_contract(client):
    runtime = client.get("/api/openapi.json").json()
    path = "/products/{productId}/inventory-entries"
    actual = runtime["paths"]["/api/v1" + path]["get"]
    expected = SOURCE["paths"][path]["get"]
    assert actual["operationId"] == expected["operationId"]
    assert actual["security"] == [{"BearerAuth": []}]
    assert actual["x-permissions"] == expected["x-permissions"]
    assert set(actual["responses"]) == set(expected["responses"])
    parameters = {item["name"]: item for item in actual["parameters"]}
    for definition in SOURCE["paths"][path]["parameters"] + expected["parameters"]:
        parameter = resolve(definition)
        generated = parameters[parameter["name"]]
        assert generated["required"] == parameter.get("required", False)
        schema = generated["schema"]
        if "anyOf" in schema:
            schema = next(item for item in schema["anyOf"] if item.get("type") != "null")
        assert_schema_constraints(parameter["schema"], schema, SOURCE, runtime)
    for status, definition in expected["responses"].items():
        source = resolve(definition)
        if "content" in source:
            assert_schema_constraints(
                source["content"]["application/json"]["schema"],
                actual["responses"][status]["content"]["application/json"]["schema"],
                SOURCE,
                runtime,
            )
        for header, definition in source.get("headers", {}).items():
            assert_schema_constraints(
                resolve(definition)["schema"],
                actual["responses"][status]["headers"][header]["schema"],
                SOURCE,
                runtime,
            )


def test_five_published_receipt_contracts_and_deferred_actions(client):
    runtime = client.get("/api/openapi.json").json()
    count = 0
    for path, methods in SOURCE["paths"].items():
        if not path.startswith("/stock-receipts"):
            continue
        if path.endswith(("/cancel", "/corrections")):
            assert "/api/v1" + path not in runtime["paths"]
            continue
        for method, expected in methods.items():
            if method == "parameters":
                continue
            count += 1
            actual = runtime["paths"]["/api/v1" + path][method]
            assert actual["operationId"] == expected["operationId"]
            assert actual["security"] == [{"BearerAuth": []}]
            assert actual["x-permissions"] == expected["x-permissions"]
            assert set(actual["responses"]) == set(expected["responses"])
            parameters = {item["name"]: item for item in actual.get("parameters", [])}
            for definition in methods.get("parameters", []) + expected.get("parameters", []):
                parameter = resolve(definition)
                generated = parameters[parameter["name"]]
                assert generated["required"] == parameter.get("required", False)
                schema = generated["schema"]
                if "anyOf" in schema:
                    schema = next(item for item in schema["anyOf"] if item.get("type") != "null")
                assert_schema_constraints(parameter["schema"], schema, SOURCE, runtime)
            if "requestBody" in expected:
                assert_schema_constraints(
                    resolve(expected["requestBody"])["content"]["application/json"]["schema"],
                    actual["requestBody"]["content"]["application/json"]["schema"],
                    SOURCE,
                    runtime,
                )
            for status, definition in expected["responses"].items():
                source = resolve(definition)
                if "content" in source:
                    assert_schema_constraints(
                        source["content"]["application/json"]["schema"],
                        actual["responses"][status]["content"]["application/json"]["schema"],
                        SOURCE,
                        runtime,
                    )
                for header, definition in source.get("headers", {}).items():
                    assert_schema_constraints(
                        resolve(definition)["schema"],
                        actual["responses"][status]["headers"][header]["schema"],
                        SOURCE,
                        runtime,
                    )
    assert count == 5
