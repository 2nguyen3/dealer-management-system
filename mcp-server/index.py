"""ASGI entrypoint for Vercel; settings come from the deployment environment."""

from agentra_mcp.config import Settings
from agentra_mcp.server import asgi_app

app = asgi_app(Settings(_env_file=None))
