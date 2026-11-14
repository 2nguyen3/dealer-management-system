"""Real-PostgreSQL fixtures for VNPAY online payments on the simplified schema."""

from dataclasses import dataclass
from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.core.security import hash_password
from app.modules.online_payments.service import OnlinePaymentService
from app.modules.online_payments.vnpay import VnpayAdapter
from tests.online_payments.harness import config
from tests.support.database import selected_database_factory

pytestmark = pytest.mark.integration

PASSWORD = "Agentra@2026#Test"
CODEC = CursorCodec(b"p" * 32)
DEBT = Decimal(1_500_000)


@pytest.fixture(scope="session")
def database_factory():
    with selected_database_factory(suite="business") as create:
        yield create


@pytest.fixture
def engine(database_factory):
    with database_factory() as engine:
        yield engine


@dataclass
class World:
    manager: int
    accountant: int
    sales: int
    agency: int
    settled: int
    terminated: int


def scalar(session, sql, **params):
    return session.execute(text(sql), params).scalar_one()


@pytest.fixture
def world(engine) -> World:
    """Users of three groups, an agency owing DEBT, a settled one and a terminated one."""
    with Session(engine) as session, session.begin():
        session.execute(text("SELECT set_config('dms.function_code', 'users.manage', true)"))
        password = hash_password(PASSWORD)

        def user(name, email, group):
            return scalar(
                session,
                'INSERT INTO dms.app_user ("fullName", email, "passwordHash", "groupId") '
                "VALUES (:n, :e, :p, (SELECT id FROM dms.user_group WHERE code = :g)) "
                "RETURNING id",
                n=name,
                e=email,
                p=password,
                g=group,
            )

        manager = user("Nguyễn Văn Quản", "manager@agentra.vn", "MANAGEMENT")
        accountant = user("Trần Thị Kế", "accountant@agentra.vn", "ACCOUNTING")
        sales = user("Lê Văn Bán", "sales@agentra.vn", "SALES")
        session.execute(text("SELECT set_config('dms.function_code', 'agency.manage', true)"))

        def agency(name, ward):
            return scalar(
                session,
                'INSERT INTO dms.agency (name, "typeId", "wardId", "acceptedDate") '
                "VALUES (:n, 1, :w, '2025-01-02') RETURNING id",
                n=name,
                w=ward,
            )

        first = agency("Tạp hóa Hồng Phúc", 1)
        settled = agency("Đại lý Thành Đạt", 2)
        terminated = agency("Cửa hàng Minh Khang", 3)
        # Balances change only in a posting context (fixture shortcut for prior history).
        session.execute(text("SELECT set_config('dms.function_code', 'cash.receipt.post', true)"))
        session.execute(
            text("UPDATE dms.agency SET debt = :d WHERE id IN (:a, :t)"),
            {"d": DEBT, "a": first, "t": terminated},
        )
        session.execute(text("SELECT set_config('dms.function_code', 'agency.manage', true)"))
        session.execute(
            text(
                "UPDATE dms.agency SET status = 'TERMINATED', "
                '"terminatedAt" = clock_timestamp(), '
                "\"terminationReason\" = 'Chủ cửa hàng chuyển nhượng mặt bằng' WHERE id = :id"
            ),
            {"id": terminated},
        )
    return World(manager, accountant, sales, first, settled, terminated)


@pytest.fixture
def payments(engine, world):
    """Factory of services, each with its own session (and so its own connection)."""
    sessions: list[Session] = []

    def make(actor: int | None = None, *, adapter=None, authorize=None) -> OnlinePaymentService:
        session = Session(engine)
        sessions.append(session)
        settings = config()
        return OnlinePaymentService(
            session,
            CODEC,
            actor,
            "test-request",
            authorize or (lambda _: None),
            settings=settings,
            adapter=adapter or VnpayAdapter(settings),
        )

    yield make
    for session in sessions:
        session.close()


def debt(engine, agency: int) -> Decimal:
    with engine.connect() as connection:
        return connection.execute(
            text("SELECT debt FROM dms.agency WHERE id = :id"), {"id": agency}
        ).scalar_one()


def counts(engine) -> dict[str, int]:
    with engine.connect() as connection:
        return {
            table: connection.execute(text(f"SELECT count(*) FROM dms.{table}")).scalar_one()
            for table in ("online_payment", "payment_event", "document")
        }


def payment_row(engine, identifier: int) -> dict:
    with engine.connect() as connection:
        return dict(
            connection.execute(
                text("SELECT * FROM dms.online_payment WHERE id = :id"), {"id": identifier}
            )
            .mappings()
            .one()
        )
