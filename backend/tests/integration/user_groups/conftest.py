import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.core.config import Settings
from app.core.security import hash_password
from app.db.session import get_session
from app.main import create_app
from app.modules.user_groups.service import GroupService
from app.modules.users.models import AppUser
from tests.support.database import selected_database_factory


@pytest.fixture(scope="session")
def database_factory():
    with selected_database_factory(suite="business") as create:
        yield create


@pytest.fixture
def engine(database_factory):
    with database_factory() as engine:
        yield engine


@pytest.fixture
def actor(engine):
    with Session(engine) as session:
        user = AppUser(
            full_name="Test",
            email="test@example.com",
            password_hash=hash_password("password"),
            group_id=1,
        )
        session.add(user)
        session.commit()
        return user.id


@pytest.fixture
def service(engine, actor):
    with Session(engine) as session:
        yield GroupService(session, CursorCodec(b"x" * 32), actor, "group-request", lambda _: None)


@pytest.fixture
def client(engine, actor):
    settings = Settings(
        _env_file=None,
        db_host="localhost",
        db_user="test",
        db_password="test",
        auth_signing_key="synthetic-test-key-32-bytes-or-more",
        auth_rate_limit=10000,
        api_rate_limit=10000,
    )
    app = create_app(settings)

    def sessions():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = sessions
    with TestClient(app, raise_server_exceptions=False) as client:
        login = client.post(
            "/api/v1/auth/login", json={"email": "test@example.com", "password": "password"}
        )
        assert login.status_code == 200
        client.headers["Authorization"] = "Bearer " + login.json()["accessToken"]
        yield client
