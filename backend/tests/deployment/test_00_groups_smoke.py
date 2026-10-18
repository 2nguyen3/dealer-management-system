import os
from uuid import uuid4

import httpx
import pytest

from app.db.seed import DEMO_USERS

pytestmark = [pytest.mark.integration, pytest.mark.deployment]


@pytest.mark.parametrize("variable", ["AUTH_SMOKE_DIRECT_URL", "AUTH_SMOKE_PROXY_URL"])
def test_group_crud_direct_and_proxy(variable):
    base = os.environ.get(variable)
    if not base or not base.startswith("http://127.0.0.1:"):
        pytest.fail("Deployment smoke requires explicit disposable loopback URL")
    email, _, _, password, _ = DEMO_USERS[0]
    with httpx.Client(
        base_url=base, timeout=float(os.getenv("AUTH_SMOKE_TIMEOUT_SECONDS", "10"))
    ) as client:
        login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert login.status_code == 200
        client.headers["Authorization"] = "Bearer " + login.json()["accessToken"]
        code = "SMOKE_" + uuid4().hex
        created = client.post("/api/v1/user-groups", json={"code": code, "name": code})
        assert created.status_code == 201 and created.json()["userCount"] == 0
        path = created.headers["Location"]
        detail = client.get(path)
        assert detail.status_code == 200 and detail.headers["ETag"] == created.headers["ETag"]
        updated = client.patch(
            path, json={"name": code + " next"}, headers={"If-Match": detail.headers["ETag"]}
        )
        assert updated.status_code == 200 and updated.headers["ETag"] != detail.headers["ETag"]
        deleted = client.delete(path, headers={"If-Match": updated.headers["ETag"]})
        assert deleted.status_code == 204 and deleted.content == b""
        assert client.get(path).status_code == 404
        assert (
            client.post(
                "/api/v1/auth/logout", json={"refreshToken": login.json()["refreshToken"]}
            ).status_code
            == 204
        )
