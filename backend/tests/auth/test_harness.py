import importlib.util
from pathlib import Path

import pytest


def test_disposable_url_guard(monkeypatch):
    location = Path(__file__).parents[1] / "integration/auth/conftest.py"
    spec = importlib.util.spec_from_file_location("auth_integration_harness", location)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for raw in (
        None,
        "sqlite:///agentra_auth_test",
        "postgresql+psycopg://localhost/postgres",
        "postgresql+psycopg://localhost/production",
    ):
        with pytest.raises(RuntimeError):
            module.guarded_test_url(raw)
    raw = "postgresql+psycopg://localhost/agentra_auth_test"
    monkeypatch.setenv("DB_NAME", "agentra_auth_test")
    with pytest.raises(RuntimeError):
        module.guarded_test_url(raw)
    monkeypatch.setenv("DB_NAME", "postgres")
    assert module.guarded_test_url(raw).database == "agentra_auth_test"
