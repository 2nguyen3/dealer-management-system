import json
import re
import runpy
from pathlib import Path
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

import deploy_vercel_env
from app.core.config import Settings
from app.db.session import get_session
from app.main import create_app

BACKEND = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize(
    ("path", "service"),
    [
        ("/", "frontend"),
        ("/login", "frontend"),
        ("/dashboard", "frontend"),
        ("/apiary", "frontend"),
        ("/api", "backend"),
        ("/api/v1/health", "backend"),
        ("/api/docs", "backend"),
        ("/api/v1/not-found", "backend"),
    ],
)
def test_service_routes_preserve_api_prefix_and_explicit_spa_root(path, service):
    config = json.loads((BACKEND.parent / "vercel.json").read_text(encoding="utf-8"))
    route = next(rule for rule in config["rewrites"] if re.fullmatch(rule["source"], path))
    assert route["destination"] == {"service": service}
    assert any(rule["source"] == "/" for rule in config["rewrites"])
    frontend = config["services"]["frontend"]
    assert {"source": "/", "destination": "/index.html"} in frontend["rewrites"]
    assert not any(
        re.fullmatch(rule["source"], "/assets/missing.js") for rule in frontend["rewrites"]
    )


def deployment_settings(**overrides):
    return Settings(
        _env_file=None,
        db_host="localhost",
        db_user="test",
        db_password="synthetic-database-secret",
        auth_signing_key="synthetic-test-key-32-bytes-or-more",
        **overrides,
    )


def test_vercel_entrypoint_uses_environment_and_preserves_api(monkeypatch):
    factory = Mock(return_value=deployment_settings())
    monkeypatch.setattr("app.core.config.Settings", factory)
    builder = Mock(wraps=create_app)
    monkeypatch.setattr("app.main.create_app", builder)
    app = runpy.run_path(str(BACKEND / "index.py"))["app"]
    factory.assert_called_once_with(_env_file=None)
    builder.assert_called_once_with(factory.return_value)
    session = Mock()
    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as client:
        assert client.get("/api/v1/health").json() == {"status": "ok"}
        assert client.get("/api/v1/health/ready").status_code == 200
        assert client.get("/api/docs").status_code == 200
        assert client.get("/api/openapi.json").status_code == 200
        assert client.get("/api/v1/not-found").status_code == 404
    session.execute.assert_called_once()

