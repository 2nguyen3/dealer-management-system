import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app
from app.modules.credit_applications.schemas import CreditApplicationCreate, CreditApplicationUpdate
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
            auth_signing_key="synthetic-contract-key-with-32-bytes",
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
            "listCreditApplications",
            "getCreditApplication",
            "createCreditApplication",
            "updateCreditApplicationDraft",
            "postCreditApplication",
        }
    ],
)
def test_credit_application_contract(runtime, path, method, expected):
    check_contract(runtime, path, method, expected)


@pytest.mark.parametrize("amount", ["0", "-1", "1000000000000000000", 1, True, "1.0", "1e2"])
def test_strict_amount(amount):
    with pytest.raises(ValidationError):
        CreditApplicationCreate(agencyId="1", businessDate="2026-01-01", amount=amount)


def test_schema_boundaries_and_patch():
    body = CreditApplicationCreate(
        agencyId="9223372036854775807", businessDate="2026-01-01", amount="999999999999999999"
    )
    assert body.model_dump(mode="json")["amount"] == "999999999999999999"
    assert CreditApplicationUpdate(note=None).model_fields_set == {"note"}
    for payload in ({}, {"amount": None}, {"agencyId": "2"}, {"cashReceived": "1"}):
        with pytest.raises(ValidationError):
            CreditApplicationUpdate.model_validate(payload)
