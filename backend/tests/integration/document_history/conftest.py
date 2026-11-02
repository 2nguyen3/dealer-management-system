import pytest

from app.modules.document_history.router import router
from tests.integration.workflows.conftest import (  # noqa: F401
    actor,
    client,
    database_factory,
    engine,
    trading,
)


@pytest.fixture
def history_client(client):  # noqa: F811
    client.app.include_router(router, prefix="/api/v1")
    return client
