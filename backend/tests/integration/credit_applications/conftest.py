import pytest

from tests.integration.workflows.conftest import (  # noqa: F401
    actor,
    client,
    database_factory,
    engine,
    trading,
)


@pytest.fixture
def credit_client(client):  # noqa: F811
    return client
