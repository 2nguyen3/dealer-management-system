"""Real-PostgreSQL fixtures for the simplified DocumentService (handoff 5.4)."""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.security import hash_password
from app.modules.document_core.service import DocumentService
from tests.support.database import selected_database_factory

pytestmark = pytest.mark.integration


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
    clerk: int
    carton: int
    kilogram: int
    noodles: int
    rice: int
    unpriced: int
    retired: int
    agency: int
    second_agency: int
    terminated: int
    max_debt: Decimal


def scalar(session, sql, **params):
    return session.execute(text(sql), params).scalar_one()


@pytest.fixture
def world(engine) -> World:
    with Session(engine) as session, session.begin():
        session.execute(text("SELECT set_config('dms.function_code', 'users.manage', true)"))
        password = hash_password("Agentra@2026#Test")
        manager = scalar(
            session,
            'INSERT INTO dms.app_user ("fullName", email, "passwordHash", "groupId") '
            "VALUES ('Quản lý', 'manager@agentra.vn', :p, 1) RETURNING id",
            p=password,
        )
        clerk = scalar(
            session,
            'INSERT INTO dms.app_user ("fullName", email, "passwordHash", "groupId") '
            "VALUES ('Kế toán', 'clerk@agentra.vn', :p, 4) RETURNING id",
            p=password,
        )
        carton = scalar(
            session, "INSERT INTO dms.unit (code, name) VALUES ('THUNG', 'Thùng') RETURNING id"
        )
        kilogram = scalar(
            session,
            'INSERT INTO dms.unit (code, name, "allowsFraction") VALUES '
            "('KG', 'Kg', true) RETURNING id",
        )

        def product(name, unit, status="ACTIVE"):
            return scalar(
                session,
                'INSERT INTO dms.product (name, "unitId", status) VALUES (:n, :u, :s) RETURNING id',
                n=name,
                u=unit,
                s=status,
            )

        noodles = product("Mì Hảo Hảo thùng 30 gói", carton)
        rice = product("Gạo ST25", kilogram)
        unpriced = product("Nước tương Maggi 700ml", carton)
        retired = product("Bánh quy Cosy 400g", carton, "INACTIVE")
        max_debt = Decimal(10_000_000)
        session.execute(text('UPDATE dms.agency_type SET "maxDebt"=:m WHERE id=1'), {"m": max_debt})

        def agency(name, ward):
            return scalar(
                session,
                'INSERT INTO dms.agency (name, "typeId", "wardId", "acceptedDate") '
                "VALUES (:n, 1, :w, '2025-01-02') RETURNING id",
                n=name,
                w=ward,
            )

        first = agency("Tạp hóa Hồng Phúc", 1)
        second = agency("Đại lý Thành Đạt", 2)
        terminated = agency("Cửa hàng Minh Khang", 3)
        session.execute(
            text(
                "UPDATE dms.agency SET status='TERMINATED', \"terminatedAt\"=clock_timestamp(), "
                "\"terminationReason\"='Chủ cửa hàng chuyển nhượng mặt bằng' WHERE id=:id"
            ),
            {"id": terminated},
        )
    return World(
        manager,
        clerk,
        carton,
        kilogram,
        noodles,
        rice,
        unpriced,
        retired,
        first,
        second,
        terminated,
        max_debt,
    )


CODEC = CursorCodec(b"d" * 32)


@pytest.fixture
def documents(engine, world):
    """Factory of DocumentService instances, each with its own session."""
    sessions: list[Session] = []

    def make(kind: str, actor: int | None = None) -> DocumentService:
        session = Session(engine)
        sessions.append(session)
        return DocumentService(
            session, CODEC, actor or world.manager, "test-request", lambda _: None, kind=kind
        )

    yield make
    for session in sessions:
        session.close()


def match(service: DocumentService, document) -> Preconditions:
    return Preconditions(service.etag(document))


def today(engine) -> date:
    with engine.connect() as connection:
        return connection.execute(text("SELECT dms.business_today()")).scalar_one()


def previous_month_day(engine) -> date:
    return today(engine).replace(day=1) - timedelta(days=1)


def balances(engine, world):
    with engine.connect() as connection:
        stock = dict(connection.execute(text("SELECT id, stock FROM dms.product")).all())
        debt = dict(connection.execute(text("SELECT id, debt FROM dms.agency")).all())
        prices = dict(
            connection.execute(text('SELECT id, "lastPurchasePrice" FROM dms.product')).all()
        )
    return stock, debt, prices
