from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Agentra API"
    db_host: str = Field(min_length=1)
    db_port: int = Field(default=5432, ge=1, le=65535)
    db_name: str = "postgres"
    db_user: str = Field(min_length=1)
    db_password: SecretStr = Field(min_length=1)
    db_sslmode: str = "require"
    cors_origins: list[str] = ["http://localhost:5173"]

    def database_url(self) -> URL:
        """Build a driver URL without requiring password URL-encoding."""
        return URL.create(
            drivername="postgresql+psycopg",
            username=self.db_user,
            password=self.db_password.get_secret_value(),
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
            query={"sslmode": self.db_sslmode},
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
