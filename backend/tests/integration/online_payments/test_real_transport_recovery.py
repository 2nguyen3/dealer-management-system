import json
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import SecretStr
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.modules.online_payments.adapter import SandboxAdapter
from app.modules.online_payments.schemas import OnlinePaymentCreate
from app.modules.online_payments.service import OnlinePaymentService
from tests.integration.settlement_core.helpers import commit, issue

pytestmark = pytest.mark.integration


def test_real_http_lost_checkout_reply_restart_and_query_settle_once(engine, actor, trading):
    references = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            assert self.headers["Authorization"] == "Bearer controlled-test-key"
            if self.path == "/checkouts":
                reference = body["merchantReference"]
                references.append(reference)
                # A separate real connection observes committed intent and can
                # obtain the money lock: transport never holds an agency lock.
                with engine.begin() as check:
                    assert (
                        check.scalar(
                            text("SELECT count(*) FROM dms.online_payment WHERE status='PENDING'")
                        )
                        == 1
                    )
                    check.execute(
                        text('SELECT "agencyId" FROM dms.agency_balance FOR UPDATE NOWAIT')
                    ).all()
                if len(references) == 1:
                    self.connection.shutdown(socket.SHUT_RDWR)
                    self.connection.close()
                    return
                result = {
                    "checkoutUrl": "https://controlled.test/recovered",
                    "expiresAt": "2026-12-01T00:00:00Z",
                }
            else:
                result = {
                    "eventKey": "real-query",
                    "merchantReference": body["merchantReference"],
                    "providerTransactionId": "real-txn",
                    "amount": "102",
                    "status": "SUCCESS",
                    "paymentTime": "2026-01-05T00:00:00Z",
                }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    adapter = SandboxAdapter(
        f"http://127.0.0.1:{server.server_port}",
        SecretStr("controlled-test-key"),
        "https://callback.test",
    )
    settings = SimpleNamespace(payment_provider="CONTROLLED", payment_expiry_seconds=1800)

    def use(session):
        return OnlinePaymentService(
            session,
            CursorCodec(b"x" * 32),
            actor,
            "real-transport",
            lambda _: None,
            settings,
            adapter,
        )

    try:
        with Session(engine) as session:
            issue(session, actor, (int(trading["agency"]), int(trading["product"])), day=4)
            commit(session)
            key = uuid4()
            body = OnlinePaymentCreate(
                agencyId=trading["agency"], provider="CONTROLLED", amount="102"
            )
            result = use(session).create(body, key)
            assert result.status == 202
        with Session(engine) as session:
            restarted = use(session)
            recovered = restarted.create(body, key)
            assert recovered.status == 201 and recovered.body["id"] == result.body["id"]
            assert len(references) == 2 and references[0] == references[1]
            complete = restarted.reconcile(int(result.body["id"]), uuid4())
            assert complete.status == "SUCCESS"
        with engine.connect() as check:
            assert (
                check.scalar(text("SELECT count(*) FROM dms.document WHERE kind='PAYMENT_RECEIPT'"))
                == 1
            )
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
