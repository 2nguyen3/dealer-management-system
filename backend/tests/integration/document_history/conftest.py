"""Real-PostgreSQL fixtures for /documents (search, detail, chain, print).

Documents are created through document_core's DocumentService so every business rule
applies. HTTP tests mount the auth, history and stock-issue routers on a minimal app
(the full ``create_app`` aggregates modules rewritten in parallel).
"""

from dataclasses import dataclass
from datetime import date, timedelta

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
from app.modules.document_core.schemas import (
    PaymentReceiptInput,
    StockIssueInput,
    StockReceiptInput,
)
from app.modules.document_history.router import router as history_router
from app.modules.document_history.service import DocumentHistoryService
from app.modules.stock_issues.router import router as stock_issues_router
from tests.integration.documents.conftest import (  # noqa: F401
    CODEC,
    database_factory,
    documents,
    engine,
    match,
    today,
    world,
)

pytestmark = pytest.mark.integration
PASSWORD = "Agentra@2026#Test"


def receipt_body(*lines, business_date=None, note=None):
    return StockReceiptInput.model_validate(
        {
            "businessDate": business_date,
            "note": note,
            "lines": [
                {"productId": str(product), "quantity": str(quantity), "unitPrice": str(price)}
                for product, quantity, price in lines
            ],
        }
    )


def issue_body(agency, *lines, business_date=None, note=None):
    return StockIssueInput.model_validate(
        {
            "agencyId": str(agency),
            "businessDate": business_date,
            "note": note,
            "lines": [
                {"productId": str(product), "quantity": str(quantity)}
                for product, quantity in lines
            ],
        }
    )


def payment_body(agency, amount, business_date=None, note=None):
    return PaymentReceiptInput.model_validate(
        {
            "agencyId": str(agency),
            "amount": str(amount),
            "businessDate": business_date,
            "note": note,
        }
    )


def post_new(service, body):
    draft = service.create(body)
    return service.post(int(draft.id), match(service, draft))


@dataclass
class History:
    """R1 receipt (D-2), I1 issue to agency (D-1), P1 payment by the clerk (D), I2 draft (D)."""

    day: date
    receipt: object
    issue: object
    payment: object
    draft: object


@pytest.fixture
def history(documents, world, engine) -> History:  # noqa: F811
    day = today(engine)
    receipt = post_new(
        documents("STOCK_RECEIPT"),
        receipt_body(
            (world.noodles, 100, 100000),
            (world.rice, 50, 20000),
            business_date=day - timedelta(days=2),
            note="Nhập lô đầu tháng",
        ),
    )
    issue = post_new(
        documents("STOCK_ISSUE"),
        issue_body(world.agency, (world.noodles, 2), business_date=day - timedelta(days=1)),
    )
    payment = post_new(
        documents("PAYMENT_RECEIPT", actor=world.clerk),
        payment_body(world.agency, 50000, business_date=day, note="Thu tiền mặt tại cửa hàng"),
    )
    draft = documents("STOCK_ISSUE").create(
        issue_body(world.second_agency, (world.rice, 3), business_date=day)
    )
    return History(day, receipt, issue, payment, draft)


@pytest.fixture
def histories(engine, world):  # noqa: F811
    """Factory of DocumentHistoryService with a given set of allowed function codes."""
    sessions: list[Session] = []

    def make(allowed, actor=None) -> DocumentHistoryService:
        session = Session(engine)
        sessions.append(session)
        return DocumentHistoryService(
            session,
            CODEC,
            actor or world.manager,
            "history-request",
            lambda _: None,
            allowed_functions=lambda: set(allowed),
        )

    yield make
    for session in sessions:
        session.close()


@dataclass
class Users:
    sales: str
    warehouse: str
    nobody: str


@pytest.fixture
def users(engine) -> Users:  # noqa: F811
    """SALES (no receipts), WAREHOUSE (no payments) and a group without read rights."""
    with Session(engine) as session, session.begin():
        session.execute(text("SELECT set_config('dms.function_code', 'users.manage', true)"))
        password = hash_password(PASSWORD)
        group = session.execute(
            text("INSERT INTO dms.user_group (code, name) VALUES ('GUEST', 'Khách') RETURNING id")
        ).scalar_one()
        session.execute(
            text(
                'INSERT INTO dms.group_permission ("groupId", "functionId", "isAllowed") '
                "SELECT :g, id, code = 'agency.read' FROM dms.app_function"
            ),
            {"g": group},
        )
        for email, name, group_id in (
            ("sales@agentra.vn", "Nhân viên kinh doanh", 2),
            ("warehouse@agentra.vn", "Thủ kho", 3),
            ("guest@agentra.vn", "Khách", group),
        ):
            session.execute(
                text(
                    'INSERT INTO dms.app_user ("fullName", email, "passwordHash", "groupId") '
                    "VALUES (:n, :e, :p, :g)"
                ),
                {"n": name, "e": email, "p": password, "g": group_id},
            )
    return Users("sales@agentra.vn", "warehouse@agentra.vn", "guest@agentra.vn")


def build_app(bind) -> FastAPI:
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
    app.state.reset_delivery = SmtpResetDelivery(settings)
    app.state.auth_limiter = AuthRateLimiter(settings.auth_rate_limit_max_buckets)
    app.middleware("http")(request_context)
    app.add_exception_handler(AuthError, auth_error_handler)
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(HTTPException, http_error_handler)
    for router in (auth_router, history_router, stock_issues_router):
        app.include_router(router, prefix="/api/v1")

    def sessions():
        with Session(bind) as session:
            yield session

    app.dependency_overrides[get_session] = sessions
    return app


@pytest.fixture
def login(engine, world):  # noqa: F811
    """Return an authenticated TestClient for an email (default: the manager)."""
    clients: list[TestClient] = []

    def make(email: str = "manager@agentra.vn") -> TestClient:
        client = TestClient(build_app(engine), raise_server_exceptions=False)
        clients.append(client)
        response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
        assert response.status_code == 200, response.text
        client.headers["Authorization"] = "Bearer " + response.json()["accessToken"]
        return client

    yield make
    for client in clients:
        client.close()
