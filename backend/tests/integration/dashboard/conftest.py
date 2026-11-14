"""Reuses the report fixtures: real DocumentService postings and a minimal HTTP app."""

from tests.integration.reports.conftest import (  # noqa: F401
    accounts,
    database_factory,
    dates,
    documents,
    engine,
    ledger,
    login,
    stocked,
    world,
)
