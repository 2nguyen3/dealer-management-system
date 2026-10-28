"""Read-only native callback reachability; safe against the explicitly selected dev API."""

import os

import httpx
import pytest

pytestmark = [pytest.mark.integration, pytest.mark.deployment]


@pytest.mark.parametrize(
    "variable", ["VNPAY_SMOKE_DIRECT_URL", "VNPAY_SMOKE_PROXY_URL", "VNPAY_SMOKE_PUBLIC_URL"]
)
def test_native_vnpay_transports_reject_unsigned_requests_without_recording_money(variable):
    base = os.environ.get(variable)
    if not base or not base.startswith(("http://127.0.0.1:", "https://")):
        pytest.fail("Explicit native development API URL required")
    with httpx.Client(
        base_url=base, timeout=30, headers={"ngrok-skip-browser-warning": "true"}
    ) as client:
        ready = client.get("/api/v1/health/ready")
        assert ready.status_code == 200 and ready.json() == {"status": "ok"}
        ipn = client.get("/api/v1/integrations/vnpay/ipn")
        assert ipn.status_code == 200 and ipn.json()["RspCode"] == "97"
        assert ipn.headers["Cache-Control"] == "no-store"
        returned = client.get("/api/v1/integrations/vnpay/return")
        assert returned.status_code == 400
        assert returned.headers["Referrer-Policy"] == "no-referrer"
