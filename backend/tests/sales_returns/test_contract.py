import pytest

from tests.support.contract import SOURCE
from tests.workflows.test_contract import (
    test_owning_operations_match_canonical_contract as check_contract,
)


@pytest.mark.parametrize(
    "path,method,expected",
    [
        (path, method, operation)
        for path, methods in SOURCE["paths"].items()
        for method, operation in methods.items()
        if isinstance(operation, dict)
        and operation.get("operationId")
        in {
            "listSalesReturns",
            "createSalesReturn",
            "getSalesReturn",
            "updateSalesReturnDraft",
            "postSalesReturn",
        }
    ],
)
def test_return_contract(runtime, path, method, expected):
    check_contract(runtime, path, method, expected)
