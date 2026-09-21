import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_database_credentials_preserve_special_characters():
    password = "p@ss:/#%$word"
    settings = Settings(
        _env_file=None,
        db_host="localhost",
        db_port=5432,
        db_name="postgres",
        db_user="postgres.project",
        db_password=password,
    )

    url = settings.database_url()

    assert url.drivername == "postgresql+psycopg"
    assert url.host == "localhost"
    assert url.port == 5432
    assert url.database == "postgres"
    assert url.username == "postgres.project"
    assert url.password == password
    assert url.query["sslmode"] == "require"
    assert password not in repr(settings)
    assert password not in str(url)


def test_empty_database_password_is_rejected():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, db_host="localhost", db_user="postgres", db_password="")
