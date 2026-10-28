import os

import pytest

from app.modules.credit_applications.router import correction_router as credit_corrections
from app.modules.sales_returns.router import correction_router as return_corrections
from app.modules.stock_issues.router import correction_router as issue_corrections
from tests.integration.documents.conftest import product  # noqa: F401
from tests.integration.settlement_core.conftest import trading  # noqa: F401
from tests.integration.user_groups.conftest import (  # noqa: F401
    actor,
    client,
    database_factory,
    engine,
)


@pytest.fixture(autouse=True, scope="session")
def require_supabase_schemas():
    if os.environ.get("SUPABASE_TEST_SCHEMAS") != "1":
        pytest.fail("M29 integration requires current Supabase with SUPABASE_TEST_SCHEMAS=1")


@pytest.fixture(autouse=True)
def include_unpublished_handlers_only_in_tests(request):
    if "client" in request.fixturenames:
        client = request.getfixturevalue("client")
        for router in (issue_corrections, return_corrections, credit_corrections):
            client.app.include_router(router, prefix="/api/v1")
        client.app.openapi_schema = None
