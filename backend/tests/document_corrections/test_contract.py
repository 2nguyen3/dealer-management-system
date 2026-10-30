import pytest

from app.main import create_app
from tests.online_payments.test_vnpay import config
from tests.support.contract import SOURCE
from tests.workflows.test_contract import (
    test_owning_operations_match_canonical_contract as check_contract,
)

OWNED = {
    prefix + suffix
    for prefix in ("correct", "cancel")
    for suffix in (
        "StockReceipt",
        "StockIssue",
        "PaymentReceipt",
        "StockAdjustment",
        "SalesReturn",
        "CreditApplication",
    )
}


@pytest.fixture(scope="module")
def runtime():
    return create_app(config()).openapi()


@pytest.mark.parametrize(
    "path,method,expected",
    [
        (path, method, operation)
        for path, methods in SOURCE["paths"].items()
        for method, operation in methods.items()
        if isinstance(operation, dict) and operation.get("operationId") in OWNED
    ],
)
def test_all_twelve_correction_operations_match_single_contract(runtime, path, method, expected):
    check_contract(runtime, path, method, expected)


def test_source_operation_inventory_has_no_extra_generic_correction_api(runtime):
    actual = {
        operation["operationId"]
        for methods in runtime["paths"].values()
        for operation in methods.values()
        if isinstance(operation, dict) and "operationId" in operation
    }
    assert OWNED <= actual and len(OWNED) == 12
    assert "/api/v1/documents/{documentId}/corrections" not in runtime["paths"]
    canonical = {
        operation["operationId"]
        for methods in SOURCE["paths"].values()
        for operation in methods.values()
        if isinstance(operation, dict) and "operationId" in operation
    }
    business = {
        operation["operationId"]
        for path, methods in runtime["paths"].items()
        if not path.startswith("/api/v1/health")
        for operation in methods.values()
        if isinstance(operation, dict) and "operationId" in operation
    }
    assert business <= canonical
    unpublished_read_products = {
        operation["operationId"]
        for path, methods in SOURCE["paths"].items()
        if path.startswith(("/reports/", "/dashboard", "/chatbot/"))
        for operation in methods.values()
        if isinstance(operation, dict) and "operationId" in operation
    }
    assert canonical - business <= unpublished_read_products
