import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import hash_password
from app.modules.users.models import AppUser
from tests.support.database import (  # noqa: F401
    guarded_test_url,
    migrate,
    selected_database_factory,
)

pytestmark = pytest.mark.integration


@pytest.fixture(scope="session")
def database_factory():
    with selected_database_factory(suite="auth") as create:
        yield create


@pytest.fixture(scope="session")
def auth_engine(database_factory):
    with database_factory() as engine:
        yield engine


@pytest.fixture
def engine(auth_engine):
    with auth_engine.begin() as connection:
        connection.exec_driver_sql("TRUNCATE dms.app_user RESTART IDENTITY CASCADE")
        grants = list(connection.execute(text('SELECT id, "isAllowed" FROM dms.group_permission')))
    yield auth_engine
    with auth_engine.begin() as connection:
        for identifier, allowed in grants:
            connection.execute(
                text('UPDATE dms.group_permission SET "isAllowed"=:allowed WHERE id=:id'),
                {"allowed": allowed, "id": identifier},
            )


@pytest.fixture
def settings():
    return Settings(
        _env_file=None,
        db_host="localhost",
        db_name="offline",
        db_user="test",
        db_password="test",
        auth_signing_key="synthetic-test-key-32-bytes-or-more",
        auth_rate_limit=10000,
        auth_login_limit=10000,
        auth_reset_request_limit=10000,
        smtp_timeout_seconds=0.01,
        auth_reset_response_floor_seconds=0.02,
    )


class CapturingDelivery:
    def __init__(self):
        self.messages = []
        self.enabled = True
        self.failure = False

    def available(self):
        return self.enabled

    def send(self, recipient, token):
        if self.failure:
            raise RuntimeError("secret-delivery-sentinel")
        self.messages.append((recipient, token))


@pytest.fixture
def delivery():
    return CapturingDelivery()


@pytest.fixture
def user(engine):
    with Session(engine) as session:
        group_id = session.scalar(text("SELECT id FROM dms.user_group WHERE code='MANAGEMENT'"))
        account = AppUser(
            full_name="Test Employee",
            email="Employee@example.com",
            password_hash=hash_password("old password"),
            group_id=group_id,
        )
        session.add(account)
        session.commit()
        return account.id


@pytest.fixture
def session(engine):
    with Session(engine) as session:
        yield session
