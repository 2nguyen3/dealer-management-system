import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from tests.auth.test_http import assert_schema_constraints
from tests.support.contract import SOURCE, resolve

OWNED = {
    "listStockIssues",
    "createStockIssue",
    "getStockIssue",
    "updateStockIssueDraft",
    "submitStockIssue",
    "replacePendingStockIssue",
    "postStockIssue",
    "listPaymentReceipts",
    "createPaymentReceipt",
    "getPaymentReceipt",
    "updatePaymentReceiptDraft",
    "postPaymentReceipt",
    "listUpfrontConfirmations",
    "verifyUpfrontPayment",
    "getUpfrontConfirmation",
    "receiveUpfrontSeparately",
    "listReceivables",
    "getAgencyBalance",
    "listAgencyInvoiceBalances",
    "getInvoiceBalance",
    "listAgencyReceivableEntries",
    "listDocumentAllocations",
}


@pytest.fixture(scope="module")
def runtime():
    settings = Settings(
        _env_file=None,
        db_host="localhost",
        db_user="test",
        db_password="test",
        auth_signing_key="synthetic-local-contract-key-32-bytes",
    )
    with TestClient(create_app(settings)) as client:
        yield client.get("/api/openapi.json").json()


@pytest.mark.parametrize(
    "path,method,expected",
    [
        (path, method, operation)
        for path, methods in SOURCE["paths"].items()
        for method, operation in methods.items()
        if isinstance(operation, dict) and operation.get("operationId") in OWNED
    ],
)
def test_owning_operations_match_canonical_contract(runtime, path, method, expected):
    actual = runtime["paths"]["/api/v1" + path][method]
    assert actual["operationId"] == expected["operationId"]
    assert actual["x-permissions"] == expected["x-permissions"]
    assert actual["security"] == [{"BearerAuth": []}]
    assert actual["tags"] == expected["tags"]
    assert set(actual["responses"]) == set(expected["responses"])
    parameters = {item["name"]: item for item in actual.get("parameters", [])}
    for definition in SOURCE["paths"][path].get("parameters", []) + expected.get("parameters", []):
        parameter = resolve(definition)
        generated = parameters.pop(parameter["name"])
        assert generated["required"] == parameter.get("required", False)
        schema = generated["schema"]
        if "anyOf" in schema:
            schema = next(item for item in schema["anyOf"] if item.get("type") != "null")
        assert_schema_constraints(parameter["schema"], schema, SOURCE, runtime)
    assert not parameters
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


def test_no_partial_cancel_correction_or_line_operations_are_published(runtime):
    for prefix in ("stock-issues", "payment-receipts"):
        for action in ("cancel", "corrections"):
            assert f"/api/v1/{prefix}/{{documentId}}/{action}" not in runtime["paths"]
    assert len(OWNED) == 22
