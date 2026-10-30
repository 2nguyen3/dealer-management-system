import os

import pytest

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
