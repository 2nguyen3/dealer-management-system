import pytest

from tests.integration.user_groups.conftest import (  # noqa: F401
    actor,
    client,
    database_factory,
    engine,
)


@pytest.fixture
def masters(client):  # noqa: F811
    district = client.post("/api/v1/districts", json={"code": "BASE", "name": "Base"}).json()["id"]
    unit = client.post("/api/v1/units", json={"code": "PIECE", "name": "Piece"}).json()["id"]
    return district, unit
