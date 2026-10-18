import os
from uuid import uuid4

import httpx
import pytest

from app.db.seed import DEMO_USERS

pytestmark = [pytest.mark.integration, pytest.mark.deployment]


@pytest.mark.parametrize("variable", ["AUTH_SMOKE_DIRECT_URL", "AUTH_SMOKE_PROXY_URL"])
@pytest.mark.parametrize("resource", ["users", "districts", "agency-types", "units"])
def test_users_and_catalogues_direct_and_nginx(variable, resource):
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
        body = (
            {"fullName": code, "email": code + "@example.com", "password": "x", "groupId": 2}
            if resource == "users"
            else {
                "code": code,
                "name": code,
                **({"maxDebt": "0"} if resource == "agency-types" else {}),
            }
        )
        created = client.post("/api/v1/" + resource, json=body)
        assert created.status_code == 201
        path = created.headers["Location"]
        detail = client.get(path)
        assert detail.status_code == 200 and detail.headers["ETag"] == created.headers["ETag"]
        updated = client.patch(
            path,
            json={"fullName" if resource == "users" else "name": code + " next"},
            headers={"If-Match": detail.headers["ETag"]},
        )
        assert updated.status_code == 200 and updated.headers["ETag"] != detail.headers["ETag"]
        assert (
            client.patch(
                path, json={"status": "ACTIVE"}, headers={"If-Match": detail.headers["ETag"]}
            ).status_code
            == 412
        )
        assert (
            client.get("/api/v1/" + resource, params={"q": code}).json()["items"][0]["id"]
            == created.json()["id"]
        )
        if resource == "users":
            member = client.post(
                "/api/v1/auth/login", json={"email": body["email"], "password": "x"}
            ).json()
            locked = client.patch(
                path, json={"status": "LOCKED"}, headers={"If-Match": updated.headers["ETag"]}
            )
            assert locked.status_code == 200
            assert client.get(
                "/api/v1/auth/me", headers={"Authorization": "Bearer " + member["accessToken"]}
            ).status_code in (401, 403)
            reset = client.post(
                path + "/password-reset",
                json={"newPassword": " "},
                headers={"If-Match": locked.headers["ETag"]},
            )
            assert reset.status_code == 204 and reset.content == b""
            assert client.get(path).json()["status"] == "LOCKED"
        else:
            deleted = client.delete(path, headers={"If-Match": updated.headers["ETag"]})
            assert deleted.status_code == 204 and deleted.content == b""
            assert client.get(path).status_code == 404
        assert (
            client.post(
                "/api/v1/auth/logout", json={"refreshToken": login.json()["refreshToken"]}
            ).status_code
            == 204
        )
