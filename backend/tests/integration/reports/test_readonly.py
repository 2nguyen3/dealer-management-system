from unittest.mock import patch

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.modules.reports.repository import ReportQueries
from app.modules.reports.service import ReportService
from tests.integration.document_corrections.helpers import snapshot
from tests.integration.document_corrections.test_http import grants
from tests.reports.test_http import interrupt_binary_response

pytestmark = pytest.mark.integration


def test_reports_and_failures_are_read_only_and_release_connections(
    client, engine, report_scenario
):
    grants(engine, ["reports.read", "sales.read", "debt.read", "inventory.read"])
    before = snapshot(engine)
    for kind in ("sales", "debt", "inventory", "product-sales", "cash-and-credit"):
        url = f"/api/v1/reports/{kind}?fromDate=2026-01-01&toDate=2026-03-01"
        assert client.get(url).status_code == 200
        invalid = client.get(url + "&cursor=not-signed")
        assert invalid.status_code == 400 and invalid.json()["code"] == "INVALID_CURSOR"
        with patch.object(
            ReportQueries,
            "statement",
            return_value=text("SELECT m30_private_missing_column FROM dms.agency"),
        ):
            failure = client.get(url)
        assert failure.status_code == 500 and "m30_private_missing_column" not in failure.text
        with patch("app.modules.reports.router.render_report", side_effect=OSError("private path")):
            failure = client.get(url, headers={"Accept": "application/pdf"})
        assert failure.status_code == 500 and "private path" not in failure.text
        assert "Content-Disposition" not in failure.headers
    # PostgreSQL itself rejects any accidental mutation in this transaction.
    with Session(engine) as session:
        session.execute(text("SET TRANSACTION READ ONLY"))
        for kind in ("sales", "debt", "inventory", "product-sales", "cash-and-credit"):
            ReportService(session, CursorCodec(b"r" * 32)).read(
                kind, "2026-01-01", "2026-03-01", export=True
            )
    for media in (
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ):
        interrupt_binary_response(
            client, "/api/v1/reports/debt?fromDate=2026-01-01&toDate=2026-03-01", media
        )
    assert snapshot(engine) == before
    assert engine.pool.checkedout() == 0
