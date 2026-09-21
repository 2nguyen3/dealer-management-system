from unittest.mock import Mock

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.core.config import Settings
from app.db.session import get_session
from app.main import create_app


def make_app():
    return create_app(
        Settings(
            _env_file=None,
            db_host="localhost",
            db_user="test",
            db_password="test",
            db_name="test",
        )
    )


def test_liveness_without_database():
    with TestClient(make_app()) as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_queries_database():
    app = make_app()
    session = Mock()
    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as client:
        response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    session.execute.assert_called_once()


def test_readiness_failure_does_not_leak_credentials():
    app = make_app()
    session = Mock()
    session.execute.side_effect = OperationalError("SELECT 1", {}, Exception("secret-password"))
    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as client:
        response = client.get("/api/v1/health/ready")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}
