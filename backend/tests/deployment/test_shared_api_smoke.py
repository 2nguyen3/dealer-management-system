import os

import httpx
import pytest

pytestmark = [pytest.mark.integration, pytest.mark.deployment]


@pytest.mark.parametrize("variable", ["AUTH_SMOKE_DIRECT_URL", "AUTH_SMOKE_PROXY_URL"])
def test_shared_browser_headers_and_safe_errors(variable):
    base = os.environ.get(variable)
    if not base or not base.startswith("http://127.0.0.1:"):
        pytest.fail("Deployment smoke requires explicit disposable loopback URL")
    with httpx.Client(
        base_url=base, timeout=float(os.getenv("AUTH_SMOKE_TIMEOUT_SECONDS", "10"))
    ) as client:
        headers = {
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "if-match,if-none-match,idempotency-key",
        }
        assert client.options("/api/v1/probe-unpublished", headers=headers).status_code == 200
        response = client.get("/api/v1/probe-unpublished", headers={"Origin": headers["Origin"]})
        assert response.status_code == 404
        assert response.json()["requestId"] == response.headers["X-Request-Id"]
        exposed = response.headers["Access-Control-Expose-Headers"]
        assert all(name in exposed for name in ("ETag", "Location", "Content-Disposition"))
        runtime = client.get("/api/openapi.json").json()
        assert (
            len([op for path, methods in runtime["paths"].items() for op in methods.values()])
            == 155
        )
