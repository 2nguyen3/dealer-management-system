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
            auth_signing_key="synthetic-signing-key-at-least-32-bytes",
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
        if isinstance(operation, dict) and "Refunds" in operation.get("tags", [])
    ],
)
def test_refund_contract(runtime, path, method, expected):
    check_contract(runtime, path, method, expected)


def test_terminal_attempt_completion_timestamp_schema_matches_source():
    from app.modules.refunds.schemas import RefundAttempt

    assert (
        RefundAttempt.model_json_schema()["then"]
        == SOURCE["components"]["schemas"]["RefundAttempt"]["then"]
    )
