from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment settings; `.env` is read from the working directory."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Backend origin; the OpenAPI document and every tool call go to {origin}/api/...
    agentra_api_url: str = Field(default="http://localhost:8000", min_length=1)
    mcp_host: str = "127.0.0.1"
    mcp_port: int = Field(default=8100, ge=1, le=65535)
    mcp_path: str = "/mcp"
    # Public base URL of this server, advertised in protected-resource metadata.
    mcp_public_url: str = ""
    mcp_token_cache_seconds: float = Field(default=30, ge=0, le=300)
    mcp_request_timeout_seconds: float = Field(default=20, gt=0, le=120)
    mcp_startup_retries: int = Field(default=10, ge=1, le=100)


@lru_cache
def get_settings() -> Settings:
    return Settings()
