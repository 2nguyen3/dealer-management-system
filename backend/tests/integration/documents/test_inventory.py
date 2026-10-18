from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.modules.document_core.models import DOCUMENT, REVISION
from app.modules.document_core.schemas import DraftLine
from app.modules.document_core.service import DocumentService
from app.modules.inventory.repository import InventoryRepository
from app.modules.inventory.service import InventoryService
from tests.integration.catalogues.helpers import agency, draft, install_builders, post_stock
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_inventory_statement_uses_full_events_before_filters_and_pages(
    client, engine, actor, product
):
    path = "/api/v1/products/" + product["id"] + "/inventory-entries"
    empty = client.get(path)
    assert empty.status_code == 200, empty.text
    assert empty.json()["openingStock"] == "0" and empty.json()["closingStock"] == "0"
    assert empty.json()["items"] == []
    assert_schema(empty.json(), "InventoryStatement")
    with Session(engine) as session:
        install_builders(session, actor)
        agency_id = agency(session)
        receipt = draft(session, int(product["id"]), quantity="10.125")
        session.execute(
            text(
                "UPDATE dms.document_revision SET \"businessDate\"='2026-01-01' "
                'WHERE "documentId"=:id'
            ),
            {"id": receipt},
        )
        post_stock(session, receipt)
        issue = draft(
            session, int(product["id"]), quantity="3", kind="STOCK_ISSUE", agency_id=agency_id
        )
        post_stock(session, issue)
        later = draft(session, int(product["id"]), quantity="5")
        session.execute(text("SET CONSTRAINTS ALL DEFERRED"))
        session.execute(
            text(
                "UPDATE dms.document_revision SET \"businessDate\"='2026-01-03' "
                'WHERE "documentId"=:id'
            ),
            {"id": later},
        )
        post_stock(session, later)
        session.commit()
    page = client.get(path, params={"limit": 1}).json()
    assert page["openingStock"] == "0" and page["closingStock"] == "12.125"
    assert page["items"][0]["quantityDelta"] == "10.125"
    assert page["items"][0]["balanceAfter"] == "10.125"
    next_page = client.get(
        path, params={"limit": 1, "cursor": page["pagination"]["nextCursor"]}
    ).json()
    assert next_page["items"][0]["quantityDelta"] == "-3"
    assert next_page["items"][0]["balanceAfter"] == "7.125"
    interval = client.get(
        path,
        params={"fromDate": "2026-01-02", "toDate": "2026-01-03", "sourceDocumentId": str(issue)},
    ).json()
    assert interval["openingStock"] == "10.125" and interval["closingStock"] == "7.125"
    assert len(interval["items"]) == 1
    descending = client.get(path, params={"sort": "-businessDate", "limit": 1}).json()
    assert descending["items"][0]["sourceDocumentId"] == str(later)
    assert descending["items"][0]["balanceAfter"] == "12.125"
    for response in (page, next_page, interval, descending):
        assert_schema(response, "InventoryStatement")
    for params, status in (
        ({"fromDate": "2026-01-03", "toDate": "2026-01-03"}, 422),
        ({"cursor": "tampered"}, 400),
        ({"sort": "id"}, 422),
    ):
        assert client.get(path, params=params).status_code == status
    assert (
        client.get(
            path, params={"sort": "-businessDate", "cursor": page["pagination"]["nextCursor"]}
        ).status_code
        == 400
    )
    assert client.get("/api/v1/products/999999/inventory-entries").status_code == 404


def test_valid_backdated_receipt_can_make_historical_stock_wider_than_stored_stock(
    client, engine, actor, product
):
    with Session(engine) as session:
        install_builders(session, actor)
        session.execute(text('UPDATE dms.agency_type SET "maxDebt"=900000000000000000 WHERE id=1'))
        agency_id = agency(session)
        first = draft(session, int(product["id"]), quantity="600000000000000")
        session.execute(
            text(
                "UPDATE dms.document_revision SET \"businessDate\"='2026-01-01' "
                'WHERE "documentId"=:id'
            ),
            {"id": first},
        )
        post_stock(session, first)
        issue = draft(
            session,
            int(product["id"]),
            quantity="500000000000000",
            kind="STOCK_ISSUE",
            agency_id=agency_id,
        )
        post_stock(session, issue)
        session.execute(text("SET CONSTRAINTS ALL DEFERRED"))
        backdated = draft(session, int(product["id"]), quantity="600000000000000")
        session.execute(
            text(
                "UPDATE dms.document_revision SET \"businessDate\"='2026-01-01' "
                'WHERE "documentId"=:id'
            ),
            {"id": backdated},
        )
        post_stock(session, backdated)
        session.commit()
    result = client.get(
        "/api/v1/products/" + product["id"] + "/inventory-entries",
        params={"fromDate": "2026-01-02"},
    )
    assert result.status_code == 200, result.text
    assert result.json()["openingStock"] == "1200000000000000"
    assert result.json()["closingStock"] == "700000000000000"
    assert_schema(result.json(), "InventoryStatement")


def test_append_reverse_and_atomic_event_balances_preserve_history(client, engine, actor, product):
    with Session(engine) as session:
        core = DocumentService(session, CursorCodec(b"x" * 32), actor, "append", lambda _: None)
        inventory = InventoryRepository(session)
        set_audit_context(session, actor, "append", function_code="stock.receipt.post")
        inventory.lock_balances([int(product["id"])])
        identifier = core.create_draft("STOCK_RECEIPT", date(2026, 1, 1), uuid4())
        core.create_line(
            identifier,
            1,
            DraftLine(
                kind="STOCK_RECEIPT", productId=product["id"], quantity="1.125", unitPrice="100"
            ),
            Preconditions(core.etag(core.get(identifier))),
        )
        document, revision = core.repo.lock_current(identifier)
        session.execute(
            DOCUMENT.update().where(DOCUMENT.c.id == identifier).values(status="POSTED")
        )
        session.execute(
            REVISION.update()
            .where(REVISION.c.id == revision["id"])
            .values(state="POSTED", postedBy=actor, postedAt=text("clock_timestamp()"))
        )
        order = core.repo.document(identifier)["businessOrder"]
        batch = core.repo.append_batch(revision["id"], "POST", uuid4(), actor)
        lines = core.repo.lines(revision["id"])
        with pytest.raises(ValueError):
            inventory.append(batch, lines, revision["businessDate"], order, direction=0)
        inventory.append(batch, lines, revision["businessDate"], order)
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        assert (
            inventory.changes([int(product["id"])])[0].model_dump(mode="json")["currentStock"]
            == "1.125"
        )
        session.commit()
        inventory.lock_balances([int(product["id"])])
        core.repo.lock_current(identifier)
        session.execute(text("SET CONSTRAINTS ALL DEFERRED"))
        reverse = core.repo.append_batch(revision["id"], "REVERSE", uuid4(), actor)
        reversals = inventory.reverse_revision(revision["id"], reverse)
        assert len(reversals) == 1
        session.execute(
            DOCUMENT.update()
            .where(DOCUMENT.c.id == identifier)
            .values(
                status="CANCELLED",
                cancelledBy=actor,
                cancelledAt=text("clock_timestamp()"),
                cancelReason="Never received",
            )
        )
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()
        with pytest.raises(ApiError) as duplicate:
            inventory.reverse_revision(revision["id"], reverse)
        assert duplicate.value.code == "REVERSAL_CONFLICT"
        assert inventory.reverse_revision(999999, reverse) == []
        assert inventory.changes([]) == []
    path = "/api/v1/products/" + product["id"] + "/inventory-entries"
    effective = client.get(path).json()
    assert effective["items"] == [] and effective["closingStock"] == "0"
    history = client.get(path, params={"effectiveOnly": False}).json()
    assert len(history["items"]) == 2
    assert [row["quantityDelta"] for row in history["items"]] == ["1.125", "-1.125"]
    assert [row["balanceAfter"] for row in history["items"]] == ["0", "0"]
    assert all(not row["isEffective"] for row in history["items"])
    assert history["items"][1]["reversesEntryId"] == history["items"][0]["id"]
    assert_schema(history, "InventoryStatement")


def test_inventory_requires_exact_read_permission_and_service_sort(client, engine, actor, product):
    path = "/api/v1/products/" + product["id"] + "/inventory-entries"
    with engine.begin() as connection:
        connection.exec_driver_sql(
            'UPDATE dms.group_permission SET "isAllowed"=false '
            "WHERE \"functionId\"=(SELECT id FROM dms.app_function WHERE code='inventory.read')"
        )
    assert client.get(path).status_code == 403
    assert client.get("/api/v1/products/" + product["id"]).status_code == 200
    saved = client.headers.pop("Authorization")
    assert client.get(path).status_code == 401
    client.headers["Authorization"] = saved
    with Session(engine) as session:
        service = InventoryService(session, CursorCodec(b"x" * 32), actor, "sort", lambda _: None)
        with pytest.raises(ApiError) as error:
            service.statement(int(product["id"]), sort="id")
        assert error.value.status == 422
