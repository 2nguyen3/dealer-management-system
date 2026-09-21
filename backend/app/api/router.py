import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import get_session

logger = logging.getLogger(__name__)
router = APIRouter()


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


@router.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    """Liveness: the API process is running; no database connection required."""
    return HealthResponse()


@router.get("/health/ready", response_model=HealthResponse, tags=["health"])
def readiness(session: Annotated[Session, Depends(get_session)]) -> HealthResponse:
    """Readiness: the configured Postgres database is reachable."""
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.warning("Database readiness check failed")
        raise HTTPException(status_code=503, detail="Database unavailable") from None
    return HealthResponse()
