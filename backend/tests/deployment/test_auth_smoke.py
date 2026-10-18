import os

import httpx
import pytest

from app.db.seed import DEMO_USERS

pytestmark = [pytest.mark.integration, pytest.mark.deployment]


@pytest.mark.parametrize("variable", ["AUTH_SMOKE_DIRECT_URL", "AUTH_SMOKE_PROXY_URL"])
def test_direct_and_proxied_auth_lifecycle(variable):
    base = os.environ.get(variable)
    if not base or not base.startswith("http://127.0.0.1:"):
        pytest.fail("Deployment smoke requires explicit disposable loopback URL")
    email, _, _, password, _ = DEMO_USERS[0]
    with httpx.Client(
        base_url=base, timeout=float(os.getenv("AUTH_SMOKE_TIMEOUT_SECONDS", "10"))
    ) as client:
        assert client.get("/api/v1/health").json() == {"status": "ok"}
        assert client.get("/api/v1/health/ready").status_code == 200
        assert client.get("/api/docs").status_code == 200
        login = client.post(
            "/api/v1/auth/login", json={"email": email.upper(), "password": password}
        )
        assert login.status_code == 200 and login.headers["Cache-Control"] == "no-store"
        original = login.json()
        headers = {"Authorization": "Bearer " + original["accessToken"]}
        me = client.get("/api/v1/auth/me", headers=headers)
        assert me.status_code == 200 and "users.manage" in me.json()["allowedFunctions"]
        refreshed = client.post(
            "/api/v1/auth/refresh", json={"refreshToken": original["refreshToken"]}
        )
        assert refreshed.status_code == 200
        assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
        logged_out = client.post(
            "/api/v1/auth/logout", json={"refreshToken": original["refreshToken"]}
        )
        assert logged_out.status_code == 204 and logged_out.content == b""
        assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
        assert (
            client.post(
                "/api/v1/auth/refresh", json={"refreshToken": refreshed.json()["refreshToken"]}
            ).status_code
            == 401
        )
        for recipient in (email, "missing@example.com"):
            response = client.post(
                "/api/v1/auth/password-reset-requests", json={"email": recipient}
            )
            assert response.status_code == 503 and response.headers["Retry-After"]


@pytest.mark.parametrize("variable", ["AUTH_SMOKE_DIRECT_URL", "AUTH_SMOKE_PROXY_URL"])
def test_forwarded_headers_cannot_bypass_limiter(variable):
    base = os.environ.get(variable)
    if not base or not base.startswith("http://127.0.0.1:"):
        pytest.fail("Deployment smoke requires explicit disposable loopback URL")
    with httpx.Client(
        base_url=base, timeout=float(os.getenv("AUTH_SMOKE_TIMEOUT_SECONDS", "10"))
    ) as client:
        for index in range(121):
            response = client.get(
                "/api/v1/auth/me",
                headers={
                    "X-Forwarded-For": f"198.51.100.{index + 1}",
                    "X-Request-Id": "untrusted-client-id",
                },
            )
            assert response.status_code in (401, 429)
            assert response.headers["X-Request-Id"] != "untrusted-client-id"
        assert response.status_code == 429
        assert int(response.headers["Retry-After"]) >= 1
