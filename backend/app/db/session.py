from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool


def build_engine(database_url: str) -> Engine:
    # Supabase manages pooling. Disable prepared statements for transaction pooler support.
    return create_engine(
        database_url,
        poolclass=NullPool,
        connect_args={"prepare_threshold": None, "connect_timeout": 5},
    )


def get_session(request: Request) -> Iterator[Session]:
    with Session(request.app.state.engine) as session:
        yield session
