import os
from types import SimpleNamespace

import pytest

from app.modules.dashboard.service import DashboardService
from tests.integration.reports.conftest import report_scenario  # noqa: F401
from tests.integration.settlement_core.conftest import trading  # noqa: F401
from tests.integration.user_groups.conftest import actor, client, engine  # noqa: F401
from tests.support.database import selected_database_factory


@pytest.fixture(scope="session")
def database_factory():
    if os.environ.get("SUPABASE_TEST_SCHEMAS") != "1":
        pytest.fail("M31 requires Supabase UUID schemas: SUPABASE_TEST_SCHEMAS=1")
    with selected_database_factory(suite="business") as create:
        yield create


@pytest.fixture
def dashboard(engine, client):  # noqa: F811
    # The shared client's login persists a real auth session in this UUID schema.
    app = client.app
    app.state.engine = engine
    return SimpleNamespace(
        service=DashboardService(engine, app.state.settings, app.state.reset_delivery),
        token=client.headers["Authorization"].split(" ", 1)[1],
        client=client,
    )
