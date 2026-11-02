import pytest

from app.core.config import Settings


@pytest.fixture
def settings():
    return Settings(
        _env_file=None,
        db_host="localhost",
        db_user="test",
        db_password="test",
        db_name="agentra_auth_test",
        auth_signing_key="synthetic-test-key-32-bytes-or-more",
        auth_rate_limit=10000,
        auth_login_limit=10000,
        auth_reset_request_limit=10000,
    )
