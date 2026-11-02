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
        in {"listAgencyCreditLots", "getCreditLot", "listAgencyCreditEntries"}
    ],
)
def test_credit_contract(runtime, path, method, expected):
    check_contract(runtime, path, method, expected)


def test_agency_balance_has_one_owner(runtime):
    operations = [
        item["operationId"]
        for methods in runtime["paths"].values()
        for method, item in methods.items()
        if method in ("get", "post", "patch", "put", "delete")
    ]
    assert operations.count("getAgencyBalance") == 1
