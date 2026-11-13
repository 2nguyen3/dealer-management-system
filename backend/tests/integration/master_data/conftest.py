import pytest

from tests.integration.user_groups.conftest import (  # noqa: F401
    actor,
    client,
    database_factory,
    engine,
)


@pytest.fixture
def masters(client):  # noqa: F811
    # Wards are the read-only catalogue loaded by revision 0010; use the first one.
    ward = client.get("/api/v1/wards", params={"limit": 1}).json()["items"][0]["id"]
    unit = client.post("/api/v1/units", json={"code": "PIECE", "name": "Piece"}).json()["id"]
    return ward, unit
