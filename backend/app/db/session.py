from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.engine import URL, Engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import QueuePool


def build_engine(database_url: URL) -> Engine:
    # Supabase manages pooling. Disable prepared statements for transaction pooler support.
    # Keep a small connection pool with pre-ping and 15s timeout for cross-region stability.
    return create_engine(
        database_url,
        poolclass=QueuePool,
        pool_size=5,
        max_overflow=5,
        pool_recycle=300,
        pool_pre_ping=True,
        connect_args={"prepare_threshold": None, "connect_timeout": 15},
    )


def get_session(request: Request) -> Iterator[Session]:
    with Session(request.app.state.engine) as session:
        yield session
