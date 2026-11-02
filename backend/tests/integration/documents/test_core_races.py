from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.request_context import set_audit_context
from app.modules.document_core.schemas import DraftLine
from app.modules.document_core.service import DocumentService
from tests.integration.catalogues.test_races import ordered_race

pytestmark = pytest.mark.integration


def test_parent_serializes_line_numbers_and_etags_on_independent_connections(
    engine, actor, client, product
):
    other = client.post(
        "/api/v1/products", json={"name": "Other", "unitId": product["unitId"]}
    ).json()
    with Session(engine) as session:
        core = DocumentService(session, CursorCodec(b"x" * 32), actor, "create", lambda _: None)
        identifier = core.create_draft("STOCK_RECEIPT", date(2026, 10, 1), uuid4())
        match = Preconditions(core.etag(core.get(identifier)))
        session.commit()

    def edit(session, product_id):
        set_audit_context(session, actor, "core-line-race", function_code="stock.receipt.prepare")
        core = DocumentService(session, CursorCodec(b"x" * 32), actor, "race", lambda _: None)
        line = core.create_line(
            identifier,
            1,
            DraftLine(kind="STOCK_RECEIPT", productId=product_id, quantity="1", unitPrice="100"),
            match,
        )
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()
        return line

    one, two = ordered_race(
        engine,
        lambda session: edit(session, product["id"]),
        lambda session: edit(session, other["id"]),
    )
    assert one.lineNo == 1 and two == "PRECONDITION_FAILED"
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.document_line").scalar() == 1
        assert (
            connection.exec_driver_sql('SELECT "totalAmount" FROM dms.document_revision').scalar()
            == 100
        )
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.inventory_entry").scalar() == 0
