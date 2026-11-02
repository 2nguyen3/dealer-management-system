import pytest

from app.core.config import Settings


@pytest.fixture
def settings():
    return Settings(
        _env_file=None,
        db_host="localhost",
        db_user="test",
        db_password="test",
        auth_signing_key="synthetic-test-key-32-bytes-or-more",
    )
