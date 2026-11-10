"""ASGI entrypoint for Vercel; deployment settings come from its environment."""

from app.core.config import Settings
from app.main import create_app

app = create_app(Settings(_env_file=None))
