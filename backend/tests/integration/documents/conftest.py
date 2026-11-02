import pytest

from tests.integration.user_groups.conftest import (  # noqa: F401
    actor,
    client,
    database_factory,
    engine,
)


@pytest.fixture
def product(client):  # noqa: F811
    unit = client.post(
        "/api/v1/units", json={"code": "KG", "name": "Kilogram", "allowsFraction": True}
    ).json()["id"]
    response = client.post("/api/v1/products", json={"name": "Grain", "unitId": unit})
    assert response.status_code == 201, response.text
    return response.json()
