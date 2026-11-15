FROM python:3.12-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:0.10.8 /uv /uvx /bin/
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH="/app/.venv/bin:$PATH" \
    MCP_HOST=0.0.0.0 MCP_PORT=8100
WORKDIR /app
RUN groupadd --system app && useradd --system --gid app app
COPY --from=builder /app/.venv /app/.venv
COPY agentra_mcp ./agentra_mcp
USER app
EXPOSE 8100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8100/healthz', timeout=3)" || exit 1
CMD ["python", "-m", "agentra_mcp"]
