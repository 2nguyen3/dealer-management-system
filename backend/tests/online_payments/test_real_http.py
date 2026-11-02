import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

import pytest
from pydantic import SecretStr

from app.core.exceptions import ApiError
from app.modules.online_payments.adapter import SandboxAdapter


def test_controlled_real_http_checkout_and_query_transport():
    received = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            received.append((self.path, body))
            assert self.headers["Authorization"] == "Bearer controlled-secret"
            if self.path == "/checkouts":
                payload = {
                    "checkoutUrl": "https://controlled.test/checkout",
                    "expiresAt": "2026-12-01T00:00:00Z",
                }
            else:
                payload = {
                    "eventKey": "query-1",
                    "merchantReference": body["merchantReference"],
                    "providerTransactionId": "txn-1",
                    "amount": "102",
                    "status": "SUCCESS",
                    "paymentTime": "2026-01-05T03:00:00Z",
                }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(payload).encode())

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        adapter = SandboxAdapter(
            f"http://127.0.0.1:{server.server_port}",
            SecretStr("controlled-secret"),
            "https://callback.test",
        )
        reference = "AGENTRA-PAY-" + "a" * 32
        assert (
            adapter.create_checkout(reference, 102).checkoutUrl
            == "https://controlled.test/checkout"
        )
        assert adapter.query_payment(reference).status == "SUCCESS"
        assert received[0][1]["amount"] == "102"
        with pytest.raises(ValueError):
            adapter.query_payment("")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
    with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
        adapter.query_payment(reference)


def test_total_transport_deadline_bounds_a_slow_body_even_with_regular_chunks():
    class SlowHandler(BaseHTTPRequestHandler):
        def do_POST(self):
            self.rfile.read(int(self.headers["Content-Length"]))
            self.send_response(200)
            self.send_header("Content-Length", "100")
            self.end_headers()
            for _ in range(100):
                try:
                    self.wfile.write(b" ")
                    self.wfile.flush()
                except OSError:
                    break
                time.sleep(0.05)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), SlowHandler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        adapter = SandboxAdapter(
            f"http://127.0.0.1:{server.server_port}",
            SecretStr("controlled"),
            "https://callback.test",
            timeout=0.3,
        )
        started = time.monotonic()
        with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
            adapter.create_checkout("reference", 1)
        assert time.monotonic() - started < 1.5
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
