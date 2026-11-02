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
            auth_signing_key="synthetic-test-key-of-at-least-32-bytes",
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
        and operation.get("operationId")
        in {
            "createOnlinePayment",
            "listOnlinePayments",
            "getOnlinePayment",
            "listPaymentEvents",
            "reconcileOnlinePayment",
        }
    ],
)
def test_canonical_authenticated_operations(runtime, path, method, expected):
    check_contract(runtime, path, method, expected)
