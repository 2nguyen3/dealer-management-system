"""Real-PostgreSQL fixtures for reports and the dashboard (simplified model, handoff 3.4).

Documents are created only through the shared DocumentService, so every figure the
reports read was produced by the real posting/cancel paths. ``app.main.create_app`` is
not used: modules rewritten in parallel may not import yet, so a minimal application
mounts the real auth, reports and dashboard routers with the production handlers.
"""

from collections.abc import Callable
from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException

from app.common.responses import (
    api_error_handler,
    auth_error_handler,
    http_error_handler,
    validation_error_handler,
)
from app.core.config import Settings
from app.core.exceptions import ApiError, AuthError
from app.core.request_context import request_context
from app.core.security import hash_password
from app.db.session import get_session
from app.modules.auth.delivery import SmtpResetDelivery
from app.modules.auth.rate_limit import AuthRateLimiter
from app.modules.auth.router import router as auth_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.document_core.schemas import (
    PaymentReceiptInput,
    StockIssueInput,
    StockReceiptInput,
)
from app.modules.document_core.service import DocumentService
from app.modules.reports.router import router as reports_router
from tests.integration.documents.conftest import (  # noqa: F401
    World,
    database_factory,
    documents,
    engine,
    match,
    today,
    world,
)

pytestmark = pytest.mark.integration

PASSWORD = "Agentra@2026#Test"


# ------------------------------------------------------------- dates ----


def month_start(day: date) -> date:
    return day.replace(day=1)


def next_month(day: date) -> date:
    return (day.replace(day=28) + timedelta(days=4)).replace(day=1)


def previous_month(day: date) -> date:
    return (day.replace(day=1) - timedelta(days=1)).replace(day=1)


@pytest.fixture
def dates(engine):  # noqa: F811
    """Business today, the current month [start, end) and the previous month's last day."""
    current = today(engine)
    start = month_start(current)
    return {
        "today": current,
        "start": start,
        "end": next_month(current),
        "previousStart": previous_month(current),
        "previousLast": start - timedelta(days=1),
    }


# ------------------------------------------------------------ bodies ----


def receipt(*lines, business_date=None):
    return StockReceiptInput.model_validate(
        {
            "businessDate": business_date,
            "lines": [
                {"productId": str(product), "quantity": str(quantity), "unitPrice": str(price)}
                for product, quantity, price in lines
            ],
        }
    )


def issue(agency, *lines, business_date=None):
    return StockIssueInput.model_validate(
        {
            "agencyId": str(agency),
            "businessDate": business_date,
            "lines": [
                {"productId": str(product), "quantity": str(quantity)}
                for product, quantity in lines
            ],
        }
    )


def payment(agency, amount, receipt_type="CASH", business_date=None):
    return PaymentReceiptInput.model_validate(
        {
            "agencyId": str(agency),
            "amount": str(amount),
            "receiptType": receipt_type,
            "businessDate": business_date,
        }
    )


class Ledger:
    """Creates drafts, posts and cancels through DocumentService only."""

    def __init__(self, documents: Callable[[str], DocumentService], engine):  # noqa: F811
        self.documents = documents
        self.engine = engine

    def draft(self, kind, body):
        return self.documents(kind).create(body)

    def post(self, kind, body):
        service = self.documents(kind)
        draft = service.create(body)
        return service.post(int(draft.id), match(service, draft))

    def cancel(self, kind, document, reason="Lập nhầm chứng từ"):
        service = self.documents(kind)
        return service.cancel(int(document.id), reason, match(service, document))

    def online(self, agency, amount, business_date=None):
        """Verified VNPAY receipt (the only path that may push debt below zero)."""
        with Session(self.engine) as session:
            service = DocumentService(
                session, None, None, "ipn-test", lambda _: None, kind="PAYMENT_RECEIPT"
            )
            identifier = service.record_online_receipt(
                agency, Decimal(amount), business_date=business_date
            )
            session.commit()
        return identifier

    def current(self):
        with self.engine.connect() as connection:
            stock = dict(connection.execute(text("SELECT id::text, stock FROM dms.product")).all())
            debt = dict(connection.execute(text("SELECT id::text, debt FROM dms.agency")).all())
        return stock, debt


@pytest.fixture
def ledger(documents, engine):  # noqa: F811
    return Ledger(documents, engine)


@pytest.fixture
def stocked(ledger, world, dates):  # noqa: F811
    """Previous month: 100 cartons of noodles at 100,000đ and 50 kg rice at 20,000đ."""
    return ledger.post(
        "STOCK_RECEIPT",
        receipt(
            (world.noodles, 100, 100000),
            (world.rice, 50, 20000),
            business_date=dates["previousLast"],
        ),
    )


# ---------------------------------------------------------------- HTTP ----


@pytest.fixture
def accounts(engine, world):  # noqa: F811
    """Extra users: sales, warehouse and one in a group without any grant."""
    with Session(engine) as session, session.begin():
        session.execute(text("SELECT set_config('dms.function_code', 'users.manage', true)"))
        empty_group = session.execute(
            text("INSERT INTO dms.user_group (code, name) VALUES ('EMPTY', 'Trống') RETURNING id")
        ).scalar_one()
        password = hash_password(PASSWORD)
        for name, email, group in (
            ("Kinh doanh", "sales@agentra.vn", 2),
            ("Thủ kho", "warehouse@agentra.vn", 3),
            ("Không quyền", "nobody@agentra.vn", empty_group),
        ):
            session.execute(
                text(
                    'INSERT INTO dms.app_user ("fullName", email, "passwordHash", "groupId") '
                    "VALUES (:n, :e, :p, :g)"
                ),
                {"n": name, "e": email, "p": password, "g": group},
            )
    return {
        "manager": "manager@agentra.vn",
        "accounting": "clerk@agentra.vn",
        "sales": "sales@agentra.vn",
        "warehouse": "warehouse@agentra.vn",
        "nobody": "nobody@agentra.vn",
    }


def build_app(engine) -> FastAPI:  # noqa: F811
    settings = Settings(
        _env_file=None,
        db_host="localhost",
        db_user="test",
        db_password="test",
        auth_signing_key="synthetic-test-key-32-bytes-or-more",
        auth_rate_limit=10000,
        api_rate_limit=10000,
    )
    app = FastAPI()
    app.state.settings = settings
    app.state.engine = engine
    app.state.reset_delivery = SmtpResetDelivery(settings)
    app.state.auth_limiter = AuthRateLimiter(settings.auth_rate_limit_max_buckets)
    app.middleware("http")(request_context)
    app.add_exception_handler(AuthError, auth_error_handler)
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(HTTPException, http_error_handler)
    for router in (auth_router, reports_router, dashboard_router):
        app.include_router(router, prefix="/api/v1")

    def sessions():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = sessions
    return app


@pytest.fixture
def login(engine, accounts):  # noqa: F811
    """Factory: a TestClient authenticated as one of ``accounts``."""
    clients = []

    def make(role: str) -> TestClient:
        client = TestClient(build_app(engine), raise_server_exceptions=False)
        clients.append(client)
        response = client.post(
            "/api/v1/auth/login", json={"email": accounts[role], "password": PASSWORD}
        )
        assert response.status_code == 200, response.text
        client.headers["Authorization"] = "Bearer " + response.json()["accessToken"]
        return client

    yield make
    for client in clients:
        client.close()
