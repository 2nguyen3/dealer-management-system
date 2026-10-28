import pytest

from app.main import create_app
from app.modules.credit_applications.router import correction_router as credit_corrections
from app.modules.sales_returns.router import correction_router as return_corrections
from app.modules.stock_issues.router import correction_router as issue_corrections
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
    app = create_app(config())
    for router in (issue_corrections, return_corrections, credit_corrections):
        app.include_router(router, prefix="/api/v1")
    return app.openapi()


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
    assert len(actual) == 149
