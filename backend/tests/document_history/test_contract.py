import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from tests.support.contract import SOURCE
from tests.workflows.test_contract import (
    test_owning_operations_match_canonical_contract as check_contract,
)


@pytest.fixture(scope="module")
def runtime():
    app = create_app(
        Settings(
            _env_file=None,
            db_host="localhost",
            db_user="test",
            db_password="test",
            auth_signing_key="synthetic-contract-key-at-least-32-bytes",
        )
    )
    with TestClient(app) as client:
        yield client.get("/api/openapi.json").json()


@pytest.mark.parametrize(
    "path,method,expected",
    [
        (path, method, operation)
        for path, methods in SOURCE["paths"].items()
        for method, operation in methods.items()
        if isinstance(operation, dict)
        and "Document History" in operation.get("tags", [])
        and operation["operationId"] != "printDocument"
    ],
)
def test_history_contract(runtime, path, method, expected):
    check_contract(runtime, path, method, expected)


def test_print_formats_remain_independent_of_owning_correction_routes(runtime):
    operation = runtime["paths"]["/api/v1/documents/{documentId}/print"]["get"]
    assert set(operation["responses"]["200"]["content"]) == {"text/html", "application/pdf"}
    assert operation["security"] == [{"BearerAuth": []}]
    assert all(
        "Document History" not in methods.get("post", {}).get("tags", [])
        for path, methods in runtime["paths"].items()
        if "/corrections" in path
    )
    from app.modules.document_history.router import line_responses

    assert "ETag" not in line_responses(200)[200]["headers"]
