from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", hide_input_in_errors=True
    )

    app_name: str = "Agentra API"
    db_host: str = Field(min_length=1)
    db_port: int = Field(default=5432, ge=1, le=65535)
    db_name: str = "postgres"
    db_user: str = Field(min_length=1)
    db_password: SecretStr = Field(min_length=1)
    db_sslmode: str = "require"
    cors_origins: list[str] = ["http://localhost:5173"]
    auth_signing_key: SecretStr = SecretStr("")
    auth_issuer: str = Field(default="agentra-api", min_length=1)
    auth_audience: str = Field(default="agentra-ui", min_length=1)
    auth_access_ttl_seconds: int = Field(default=900, gt=0)
    auth_refresh_ttl_seconds: int = Field(default=604800, gt=0)
    auth_reset_ttl_seconds: int = Field(default=1800, gt=0)
    auth_rate_limit_max_buckets: int = Field(default=10000, gt=0)
    auth_rate_limit: int = Field(default=120, gt=0)
    auth_rate_window_seconds: int = Field(default=60, gt=0)
    api_rate_limit: int = Field(default=120, gt=0)
    api_rate_window_seconds: int = Field(default=60, gt=0)
    auth_login_limit: int = Field(default=10, gt=0)
    auth_login_window_seconds: int = Field(default=60, gt=0)
    auth_reset_request_limit: int = Field(default=3, gt=0)
    auth_reset_request_window_seconds: int = Field(default=900, gt=0)
    auth_reset_limit: int = Field(default=10, gt=0)
    auth_reset_window_seconds: int = Field(default=60, gt=0)
    auth_reset_response_floor_seconds: float = Field(default=6, gt=0)
    auth_reset_url: str = ""
    auth_mail_enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_from: str = ""
    smtp_username: str = ""
    smtp_password: SecretStr = SecretStr("")
    smtp_tls_mode: Literal["starttls", "ssl"] = "starttls"
    smtp_timeout_seconds: float = Field(default=5, gt=0)

    @model_validator(mode="after")
    def validate_auth(self) -> "Settings":
        if self.auth_access_ttl_seconds > self.auth_refresh_ttl_seconds:
            raise ValueError("Access lifetime must not exceed refresh lifetime")
        if self.auth_reset_response_floor_seconds <= self.smtp_timeout_seconds:
            raise ValueError("Reset response floor must exceed SMTP timeout")
        if bool(self.smtp_username) != bool(self.smtp_password.get_secret_value()):
            raise ValueError("SMTP credentials must be paired")
        if self.auth_reset_url:
            url = urlsplit(self.auth_reset_url)
            if url.scheme not in ("http", "https") or not url.hostname or url.fragment:
                raise ValueError("Reset URL must be absolute HTTP(S) without a fragment")
            if url.username or url.password:
                raise ValueError("Reset URL must not contain credentials")
        if self.auth_mail_enabled:
            from email_validator import EmailNotValidError, validate_email

            if not self.smtp_host or not self.smtp_from or not self.auth_reset_url:
                raise ValueError("Enabled mail requires host, sender and reset URL")
            if any(c in self.smtp_host for c in "\r\n"):
                raise ValueError("Invalid SMTP host")
            try:
                validate_email(self.smtp_from, check_deliverability=False)
            except EmailNotValidError:
                raise ValueError("Invalid SMTP sender") from None
        return self

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


def validate_auth_startup_settings(settings: Settings) -> None:
    if len(settings.auth_signing_key.get_secret_value().encode("utf-8")) < 32:
        raise ValueError("AUTH_SIGNING_KEY must contain at least 32 UTF-8 bytes")
