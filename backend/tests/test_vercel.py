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


@pytest.mark.parametrize("environment", ["preview", "production"])
def test_env_upload_uses_stdin_and_never_overwrites(monkeypatch, capsys, environment):
    settings = deployment_settings()
    monkeypatch.setattr("sys.argv", ["deploy_vercel_env.py", "--environment", environment])
    monkeypatch.setattr(deploy_vercel_env.shutil, "which", lambda _: "npx")
    monkeypatch.setattr(deploy_vercel_env, "Settings", Mock(return_value=settings))
    runner = Mock(return_value=Mock(returncode=0))
    monkeypatch.setattr(deploy_vercel_env.subprocess, "run", runner)
    assert deploy_vercel_env.main() == 0
    assert runner.call_count == 10
    supplied = {}
    for call in runner.call_args_list:
        command = call.args[0]
        supplied[command[5]] = call.kwargs["input"]
        assert command[6:] == ["--environment", environment, "--sensitive", "--yes"]
        assert "--force" not in command
        assert settings.db_password.get_secret_value() not in command
        assert call.kwargs["cwd"] == BACKEND.parent
    assert supplied["DB_PASSWORD"] == settings.db_password.get_secret_value()
    assert supplied["CORS_ORIGINS"] == "[]"
    assert not any(name.startswith(("VITE_", "PAYMENT_", "VNPAY_", "SMTP_")) for name in supplied)
    output = capsys.readouterr().out
    assert settings.db_password.get_secret_value() not in output
    assert settings.auth_signing_key.get_secret_value() not in output


def test_env_upload_hides_cli_errors_and_stops(monkeypatch, capsys):
    monkeypatch.setattr("sys.argv", ["deploy_vercel_env.py"])
    monkeypatch.setattr(deploy_vercel_env.shutil, "which", lambda _: "npx")
    monkeypatch.setattr(deploy_vercel_env, "Settings", Mock(return_value=deployment_settings()))
    runner = Mock(return_value=Mock(returncode=1, stderr="secret-cli-error", stdout="secret"))
    monkeypatch.setattr(deploy_vercel_env.subprocess, "run", runner)
    assert deploy_vercel_env.main() == 1
    runner.assert_called_once()
    assert "secret" not in capsys.readouterr().out


@pytest.mark.parametrize("missing_cli", [True, False])
def test_env_upload_rejects_missing_prerequisites(monkeypatch, capsys, missing_cli):
    monkeypatch.setattr("sys.argv", ["deploy_vercel_env.py"])
    monkeypatch.setattr(deploy_vercel_env.shutil, "which", lambda _: None if missing_cli else "npx")
    monkeypatch.setattr(deploy_vercel_env, "Settings", Mock(side_effect=ValueError("secret")))
    runner = Mock()
    monkeypatch.setattr(deploy_vercel_env.subprocess, "run", runner)
    assert deploy_vercel_env.main() == 1
    runner.assert_not_called()
    assert "secret" not in capsys.readouterr().out

