"""Opt-in isolated VNPAY acceptance using a separately provisioned public test endpoint.

Run from backend: SUPABASE_TEST_SCHEMAS=1 uv run python -m tests.support.vnpay_acceptance
Only sandbox-card transactions belong here. Main dms business rows are never fixtures.
VNPAY_ACCEPTANCE_PUBLIC_URL must differ from the running dev domain. This helper
never starts, stops or redirects ngrok endpoints. Generated schemas are dropped on exit.
"""

import os
import threading
import time
from datetime import datetime
from html import escape
from urllib.parse import urlsplit
from uuid import uuid4
from zoneinfo import ZoneInfo

import uvicorn
from fastapi.responses import HTMLResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.config import Settings
from app.core.exceptions import ApiError
from app.core.security import hash_password
from app.db.session import get_session
from app.main import create_app
from app.modules.document_history.router import router as history_router
from app.modules.online_payments.router import router as payment_router
from app.modules.online_payments.schemas import OnlinePaymentCreate
from app.modules.online_payments.service import OnlinePaymentService
from app.modules.online_payments.vnpay import VnpayAdapter
from app.modules.payment_receipts.schemas import PaymentReceiptCreate
from app.modules.payment_receipts.service import PaymentReceiptService
from app.modules.refunds.online import OnlineRefundService
from app.modules.refunds.router import router as refund_router
from app.modules.refunds.schemas import RefundCreate
from app.modules.users.models import AppUser
from tests.integration.catalogues.helpers import agency, install_builders, product
from tests.integration.settlement_core.helpers import commit, issue
from tests.support.database import selected_database_factory


def run():
    if os.environ.get("SUPABASE_TEST_SCHEMAS") != "1":
        raise RuntimeError("Explicit Supabase-schema opt-in required")
    settings = Settings()
    public = urlsplit(os.environ.get("VNPAY_ACCEPTANCE_PUBLIC_URL", ""))
    if (
        public.scheme != "https"
        or not public.hostname
        or public.username
        or public.password
        or public.query
        or public.fragment
        or public.path not in ("", "/")
        or public.netloc == urlsplit(settings.vnpay_ipn_url).netloc
    ):
        raise RuntimeError("A separate, already-provisioned HTTPS test endpoint is required")
    base = f"https://{public.netloc}"
    settings = settings.model_copy(
        update={
            "vnpay_ipn_url": base + "/api/v1/integrations/vnpay/ipn",
            "vnpay_return_url": base + "/api/v1/integrations/vnpay/return",
        }
    )
    if not settings.vnpay_tmn_code:
        raise RuntimeError("Native sandbox credentials required")
    codec = CursorCodec(settings.auth_signing_key.get_secret_value().encode())
    with selected_database_factory() as create, create() as engine:
        with Session(engine) as session:
            user = AppUser(
                full_name="VNPAY acceptance",
                email="vnpay@example.com",
                password_hash=hash_password("synthetic-sandbox-user"),
                group_id=1,
            )
            session.add(user)
            session.commit()
            actor = user.id
            install_builders(session, actor)
            agency_id = agency(session)
            unit = session.scalar(
                text("INSERT INTO dms.unit(code,name) VALUES ('PCS','Piece') RETURNING id")
            )
            product_id = product(session, unit)
            receipt = session.scalar(
                text("""
                SELECT pg_temp.stock_draft('STOCK_RECEIPT',NULL,DATE '2026-01-01',
                jsonb_build_array(jsonb_build_object('product',CAST(:id AS bigint),
                  'quantity',100,'price',100)),gen_random_uuid())
            """),
                {"id": product_id},
            )
            session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": receipt})
            commit(session)
            issue(session, actor, (agency_id, product_id), day=4, quantity=100)
            commit(session)
            payment = OnlinePaymentService(
                session,
                codec,
                actor,
                "sandbox-acceptance",
                lambda _: None,
                settings,
                VnpayAdapter(settings),
            )
            created = payment.create(
                OnlinePaymentCreate(agencyId=str(agency_id), provider="VNPAY", amount="10200"),
                uuid4(),
            )
            payment_id = int(created.body["id"])
            checkout = created.body["checkoutUrl"]
            cash = PaymentReceiptService(session, codec, actor, "sandbox-cash", lambda _: None)
            draft = cash.create(
                PaymentReceiptCreate(
                    agencyId=str(agency_id),
                    businessDate="2026-01-05",
                    amount="10200",
                    paymentMethod="CASH",
                ),
                uuid4(),
            )
            cash.post(int(draft.body["id"]), Preconditions(draft.headers["ETag"]), uuid4())

        app = create_app(settings)
        app.include_router(payment_router, prefix="/api/v1")
        app.include_router(refund_router, prefix="/api/v1")
        app.include_router(history_router, prefix="/api/v1")

        def sessions():
            with Session(engine) as session:
                yield session

        app.dependency_overrides[get_session] = sessions
        state = {"paymentId": str(payment_id), "refundAttemptId": None}

        @app.get("/acceptance", include_in_schema=False)
        def landing():
            return HTMLResponse(
                "<meta charset='utf-8'><h1>VNPAY Sandbox — isolated acceptance</h1>"
                "<p>10200 VND, synthetic fixtures only.</p>"
                f"<a href='{escape(checkout, quote=True)}'>Thanh toán VNPAY Sandbox</a>"
            )

        @app.get("/acceptance/status", include_in_schema=False)
        def status():
            with Session(engine) as session:
                row = (
                    session.execute(
                        text(
                            'SELECT status,"receiptDocumentId" FROM dms.online_payment WHERE id=:id'
                        ),
                        {"id": payment_id},
                    )
                    .mappings()
                    .one()
                )
                return {
                    **state,
                    "paymentStatus": row["status"],
                    "receiptDocumentId": None
                    if row["receiptDocumentId"] is None
                    else str(row["receiptDocumentId"]),
                    "eventCount": session.scalar(text("SELECT count(*) FROM dms.payment_event")),
                    "credit": str(
                        session.scalar(text('SELECT "currentCredit" FROM dms.agency_balance'))
                    ),
                }

        @app.post("/acceptance/reconcile", include_in_schema=False)
        def reconcile():
            with Session(engine) as session:
                service = OnlinePaymentService(
                    session,
                    codec,
                    actor,
                    "external-query",
                    lambda _: None,
                    settings,
                    VnpayAdapter(settings),
                )
                try:
                    value = service.reconcile(payment_id, uuid4())
                    return {"status": value.status, "receiptDocumentId": value.receiptDocumentId}
                except ApiError as error:
                    return {"code": error.code, "details": error.details}

        @app.post("/acceptance/refund", include_in_schema=False)
        def refund():
            with Session(engine) as session:
                service = OnlineRefundService(
                    session,
                    codec,
                    actor,
                    "external-refund",
                    lambda _: None,
                    VnpayAdapter(settings),
                    provider="VNPAY",
                )
                if state["refundAttemptId"] is not None:
                    try:
                        return service.reconcile(int(state["refundAttemptId"]), uuid4()).model_dump(
                            mode="json"
                        )
                    except ApiError as error:
                        return {"code": error.code, "details": error.details}
                source = session.scalar(
                    text('SELECT "receiptDocumentId" FROM dms.online_payment WHERE id=:id'),
                    {"id": payment_id},
                )
                session.rollback()
                if source is None:
                    return {"code": "PAYMENT_NOT_SUCCESSFUL"}
                draft = service.create(
                    RefundCreate(
                        originDocumentId=str(source),
                        businessDate=datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date().isoformat(),
                        amount="5000",
                        paymentMethod="ONLINE",
                    ),
                    uuid4(),
                )
                identifier = int(draft.body["id"])
                ready = service.submit(identifier, Preconditions(draft.headers["ETag"]), uuid4())
                attempt = service.request(identifier, Preconditions(ready.headers["ETag"]), uuid4())
                state["refundAttemptId"] = attempt.id
                return attempt.model_dump(mode="json")

        server = uvicorn.Server(
            uvicorn.Config(app, host="127.0.0.1", port=18000, access_log=False, log_level="warning")
        )

        @app.post("/acceptance/finish", include_in_schema=False)
        def finish():
            server.should_exit = True
            return {"stopping": True}

        worker = threading.Thread(target=server.run, daemon=True)
        worker.start()
        for _ in range(100):
            if server.started:
                break
            time.sleep(0.1)
        if not server.started:
            raise RuntimeError("Isolated acceptance server did not start")
        print("Isolated acceptance ready at http://127.0.0.1:18000/acceptance", flush=True)
        print("The existing dev server and ngrok routing are unchanged", flush=True)
        try:
            worker.join(timeout=1800)
        finally:
            server.should_exit = True
            worker.join(timeout=15)


if __name__ == "__main__":
    run()
