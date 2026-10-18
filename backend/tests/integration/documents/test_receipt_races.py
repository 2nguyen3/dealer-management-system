from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.request_context import set_audit_context
from app.modules.document_core.schemas import DraftLine
from app.modules.document_core.service import DocumentService
from app.modules.products.schemas import ProductUpdate
from app.modules.products.service import ProductService
from app.modules.stock_receipts.schemas import StockReceiptCreate
from app.modules.stock_receipts.service import StockReceiptService
from app.modules.units.schemas import UnitUpdate
from app.modules.units.service import UnitService
from tests.integration.catalogues.helpers import agency, draft, install_builders, post_stock
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.documents.test_receipts import post_receipt, receipt

pytestmark = pytest.mark.integration


def service(session, actor):
    return StockReceiptService(
        session, CursorCodec(b"x" * 32), actor, "receipt-race", lambda _: None
    )


def test_same_create_key_and_same_post_key_have_one_committed_winner(
    client, engine, actor, product
):
    body = StockReceiptCreate(
        businessDate="2026-10-01",
        lines=[{"productId": product["id"], "quantity": "2", "unitPrice": "100"}],
    )
    key = uuid4()
    one, two = ordered_race(
        engine,
        lambda session: service(session, actor).create(body, key),
        lambda session: service(session, actor).create(body, key),
    )
    assert one == two
    identifier = int(one.body["id"])
    condition = Preconditions(one.headers["ETag"])
    key = uuid4()
    one, two = ordered_race(
        engine,
        lambda session: service(session, actor).post(identifier, condition, key),
        lambda session: service(session, actor).post(identifier, condition, key),
    )
    assert one == two and one.body["status"] == "POSTED"
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.document").scalar() == 1
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.posting_batch").scalar() == 1
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.inventory_entry").scalar() == 1
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.api_idempotency").scalar() == 2


def test_two_receipts_serialize_stock_and_same_day_price_sources(client, engine, actor, product):
    one = receipt(client, product, quantity="2", price="200")
    two = receipt(client, product, quantity="3", price="300")
    first, second = ordered_race(
        engine,
        lambda session: service(session, actor).post(
            int(one.json()["id"]), Preconditions(one.headers["ETag"]), uuid4()
        ),
        lambda session: service(session, actor).post(
            int(two.json()["id"]), Preconditions(two.headers["ETag"]), uuid4()
        ),
    )
    assert first.body["inventoryChanges"][0]["currentStock"] == "2"
    assert second.body["inventoryChanges"][0]["currentStock"] == "5"
    current = client.get("/api/v1/products/" + product["id"]).json()
    assert current["currentStock"] == "5" and current["currentPurchasePrice"] == "300"
    assert current["priceSource"]["documentId"] == two.json()["id"]


@pytest.mark.parametrize("leading", ["edit", "post"])
def test_edit_and_post_restart_discovery_or_reject_stale_parent(
    client, engine, actor, product, leading
):
    created = receipt(client, product)
    other = client.post(
        "/api/v1/products", json={"name": "Other", "unitId": product["unitId"]}
    ).json()
    identifier = int(created.json()["id"])
    condition = Preconditions(created.headers["ETag"])

    def edit(session):
        set_audit_context(session, actor, "edit-race", function_code="stock.receipt.prepare")
        core = DocumentService(session, CursorCodec(b"x" * 32), actor, "edit", lambda _: None)
        line = core.create_line(
            identifier,
            1,
            DraftLine(kind="STOCK_RECEIPT", productId=other["id"], quantity="1", unitPrice="100"),
            condition,
        )
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()
        return line

    def post(session):
        return service(session, actor).post(identifier, condition, uuid4())

    first, second = ordered_race(
        engine, edit if leading == "edit" else post, post if leading == "edit" else edit
    )
    assert second == "PRECONDITION_FAILED"
    if leading == "edit":
        assert first.lineNo == 2
        assert client.get(created.headers["Location"]).json()["status"] == "DRAFT"
    else:
        assert first.body["status"] == "POSTED"


@pytest.mark.parametrize("master", ["unit", "product"])
@pytest.mark.parametrize("leading", ["inactivate", "post"])
def test_master_inactivation_vs_receipt_post_both_orders(
    client, engine, actor, product, master, leading
):
    created = receipt(client, product)
    path = (
        "/api/v1/units/" + str(product["unitId"])
        if master == "unit"
        else "/api/v1/products/" + product["id"]
    )
    current = client.get(path)

    def inactivate(session):
        kind, model = (
            (UnitService, UnitUpdate) if master == "unit" else (ProductService, ProductUpdate)
        )
        identifier = product["unitId"] if master == "unit" else int(product["id"])
        return kind(session, CursorCodec(b"x" * 32), actor, "master-race", lambda _: None).update(
            identifier, model(status="INACTIVE"), Preconditions(current.headers["ETag"])
        )

    def post(session):
        return service(session, actor).post(
            int(created.json()["id"]), Preconditions(created.headers["ETag"]), uuid4()
        )

    first, second = ordered_race(
        engine,
        inactivate if leading == "inactivate" else post,
        post if leading == "inactivate" else inactivate,
    )
    if leading == "inactivate":
        assert first.status == "INACTIVE" and second == "INACTIVE_MASTER"
    else:
        assert first.body["status"] == "POSTED"
        if master == "unit":
            assert second.status == "INACTIVE"
        else:
            assert second == "PRECONDITION_FAILED"
            current = client.get(path)
            assert (
                client.patch(
                    path, json={"status": "INACTIVE"}, headers={"If-Match": current.headers["ETag"]}
                ).status_code
                == 200
            )


@pytest.mark.parametrize("leading", ["receipt", "issue"])
def test_receipt_post_vs_ready_issue_preserves_frozen_price_and_stock(
    client, engine, actor, product, leading
):
    initial = receipt(client, product, business_date="2026-01-01", quantity="10", price="100")
    assert post_receipt(client, initial).status_code == 200
    with Session(engine) as session:
        install_builders(session, actor)
        agency_id = agency(session)
        issue = draft(
            session, int(product["id"]), quantity="3", kind="STOCK_ISSUE", agency_id=agency_id
        )
        session.execute(text("SELECT pg_temp.ready(:id)"), {"id": issue})
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()
    incoming = receipt(client, product, business_date="2026-01-02", quantity="5", price="200")

    def receive(session):
        return service(session, actor).post(
            int(incoming.json()["id"]), Preconditions(incoming.headers["ETag"]), uuid4()
        )

    def issue_goods(session):
        install_builders(session, actor)
        post_stock(session, issue)
        session.commit()
        return issue

    one, two = ordered_race(
        engine,
        receive if leading == "receipt" else issue_goods,
        issue_goods if leading == "receipt" else receive,
    )
    assert one is not None and two is not None
    with engine.connect() as connection:
        assert (
            connection.exec_driver_sql('SELECT "currentStock" FROM dms.inventory_balance').scalar()
            == 12
        )
        assert (
            connection.execute(
                text(
                    'SELECT "unitPrice" FROM dms.document_line WHERE "revisionId"='
                    '(SELECT "currentRevisionId" FROM dms.document WHERE id=:id)'
                ),
                {"id": issue},
            ).scalar()
            == 102
        )
        assert (
            connection.exec_driver_sql('SELECT "currentDebt" FROM dms.agency_balance').scalar()
            == 306
        )
