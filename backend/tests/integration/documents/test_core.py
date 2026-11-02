from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError, AuthError
from app.db.seed import main as seed_demo
from app.modules.document_core.models import DOCUMENT, REVISION
from app.modules.document_core.schemas import DraftLine
from app.modules.document_core.service import DocumentService
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_empty_draft_identity_revision_and_balance_neutrality(engine, actor, product):
    with Session(engine) as session:
        core = DocumentService(session, CursorCodec(b"x" * 32), actor, "core", lambda _: None)
        identifier = core.create_draft("STOCK_RECEIPT", date(2026, 10, 1), uuid4())
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()
        detail = core.get(identifier)
        assert detail.code == f"PN-{identifier}"
        assert detail.currentRevision.revisionNo == 1
        assert detail.currentRevision.lines == []
        assert_schema(detail.model_dump(mode="json"), "StockReceipt")
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.inventory_entry").scalar() == 0
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.receivable_entry").scalar() == 0
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.credit_entry").scalar() == 0
        assert (
            connection.exec_driver_sql('SELECT "currentStock" FROM dms.inventory_balance').scalar()
            == 0
        )


def test_missing_ownership_new_revision_and_kind_authorization(engine, actor, product):
    with Session(engine) as session:
        core = DocumentService(session, CursorCodec(b"x" * 32), actor, "ownership", lambda _: None)
        with pytest.raises(ValueError):
            core.create_draft("NOT_A_KIND", date(2026, 10, 1), uuid4())
        with pytest.raises(ApiError) as absent:
            core.get(999999)
        assert absent.value.status == 404
        identifier = core.create_draft("STOCK_RECEIPT", date(2026, 10, 1), uuid4())
        with pytest.raises(ApiError) as revision:
            core.get_revision(identifier, 2)
        assert revision.value.status == 404
        for reason in ("", " ", None):
            with pytest.raises(ApiError) as error:
                core.new_revision(identifier, date(2026, 10, 2), reason)
            assert error.value.status == 422
        new = core.new_revision(identifier, date(2026, 10, 2), "Header error")
        assert core.get_revision(identifier, 2).reason == "Header error"
        assert core.get(identifier).currentRevision.revisionNo == 1
        session.execute(
            text('UPDATE dms.document SET "currentRevisionId"=:revision WHERE id=:id'),
            {"id": identifier, "revision": new},
        )
        assert core.get(identifier).currentRevision.revisionNo == 2
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()

        def deny(required):
            if required != ("inventory.read",):
                raise AuthError(403, "FORBIDDEN", "Denied")

        core.authorize = deny
        assert core.get(identifier).id == str(identifier)
        core.authorize = lambda _: (_ for _ in ()).throw(AuthError(403, "FORBIDDEN", "Denied"))
        with pytest.raises(AuthError):
            core.get(identifier)


@pytest.mark.parametrize(
    "change,code",
    [
        ({"kind": "STOCK_ISSUE"}, "LINE_CONFLICT"),
        ({"quantity": "-1"}, "LINE_CONFLICT"),
        ({"unitPrice": "0"}, "LINE_CONFLICT"),
        ({"originLineId": "999"}, "LINE_CONFLICT"),
        ({"returnAmount": "1"}, "LINE_CONFLICT"),
        ({"quantity": "999999999999999.999", "unitPrice": "999999999999999999"}, "TOTAL_OVERFLOW"),
    ],
)
def test_invalid_draft_line_leaves_document_unchanged(engine, actor, product, change, code):
    with Session(engine) as session:
        core = DocumentService(
            session, CursorCodec(b"x" * 32), actor, "invalid-line", lambda _: None
        )
        identifier = core.create_draft("STOCK_RECEIPT", date(2026, 10, 1), uuid4())
        before = core.get(identifier)
        body = DraftLine.model_validate(
            {
                "kind": "STOCK_RECEIPT",
                "productId": product["id"],
                "quantity": "1",
                "unitPrice": "100",
                **change,
            }
        )
        with pytest.raises(ApiError) as error:
            core.create_line(identifier, 1, body, Preconditions(core.etag(before)))
        assert error.value.code == code
        assert core.get(identifier) == before
        session.commit()


def test_integer_unit_missing_line_revision_stale_etag_and_frozen_content(engine, actor, client):
    unit = client.post("/api/v1/units", json={"code": "PCS", "name": "Piece"}).json()["id"]
    product = client.post("/api/v1/products", json={"name": "Piece", "unitId": unit}).json()
    with Session(engine) as session:
        core = DocumentService(session, CursorCodec(b"x" * 32), actor, "guards", lambda _: None)
        identifier = core.create_draft("STOCK_RECEIPT", date(2026, 10, 1), uuid4())
        body = DraftLine(
            kind="STOCK_RECEIPT", productId=product["id"], quantity="0.125", unitPrice="100"
        )
        match = Preconditions(core.etag(core.get(identifier)))
        with pytest.raises(ApiError) as fraction:
            core.create_line(identifier, 1, body, match)
        assert fraction.value.code == "INVALID_QUANTITY"
        body = body.model_copy(update={"quantity": Decimal(1)})
        for mutation, status in (
            (lambda: core.create_line(identifier, 2, body, match), 404),
            (lambda: core.replace_line(identifier, 1, 9999, body, match), 404),
            (lambda: core.delete_line(identifier, 1, 9999, match), 404),
            (lambda: core.create_line(identifier, 1, body, Preconditions('"stale"')), 412),
        ):
            with pytest.raises(ApiError) as error:
                mutation()
            assert error.value.status == status
        line = core.create_line(identifier, 1, body, match)
        session.execute(
            text(
                "UPDATE dms.document SET status='CANCELLED',\"cancelledBy\"=:actor,"
                '"cancelledAt"=clock_timestamp(),"cancelReason"=\'Never received\' WHERE id=:id'
            ),
            {"actor": actor, "id": identifier},
        )
        with pytest.raises(ApiError) as frozen:
            core.delete_line(
                identifier, 1, int(line.id), Preconditions(core.etag(core.get(identifier)))
            )
        assert frozen.value.code == "STATE_CONFLICT"
        session.commit()


def test_all_seeded_kinds_and_historical_revisions_have_exact_projections(database_factory):
    with database_factory() as engine:
        with (
            patch("app.db.seed.build_engine", return_value=engine),
            patch(
                "app.db.seed.get_settings",
                return_value=SimpleNamespace(database_url=lambda: engine.url),
            ),
        ):
            seed_demo()
        schemas = {
            "STOCK_RECEIPT": "StockReceipt",
            "STOCK_ISSUE": "StockIssue",
            "PAYMENT_RECEIPT": "PaymentReceipt",
            "STOCK_ADJUSTMENT": "StockAdjustment",
            "SALES_RETURN": "SalesReturn",
            "CREDIT_APPLICATION": "CreditApplication",
            "REFUND": "Refund",
        }
        with Session(engine) as session:
            core = DocumentService(session, CursorCodec(b"x" * 32), 1, "seed-reads", lambda _: None)
            ids = session.execute(text("SELECT id,kind FROM dms.document ORDER BY id")).all()
            assert {kind for _, kind in ids} == set(schemas)
            for identifier, kind in ids:
                detail = core.get(identifier)
                assert_schema(detail.model_dump(mode="json"), schemas[kind])
                numbers = session.scalars(
                    text('SELECT "revisionNo" FROM dms.document_revision WHERE "documentId"=:id'),
                    {"id": identifier},
                )
                for number in numbers:
                    revision = core.get_revision(identifier, number)
                    assert_schema(revision.model_dump(mode="json"), "Revision")
                    for line in revision.lines:
                        assert core.get_line(identifier, number, int(line.id)) == line
            from app.modules.inventory.service import InventoryService

            inventory = InventoryService(
                session, CursorCodec(b"x" * 32), 1, "seed-reads", lambda _: None
            )
            products = session.execute(
                text('SELECT "productId","currentStock" FROM dms.inventory_balance')
            ).all()
            for product_id, stock in products:
                for effective in (True, False):
                    statement = inventory.statement(product_id, effectiveOnly=effective, limit=100)
                    assert statement.closingStock == stock
                    assert_schema(statement.model_dump(mode="json"), "InventoryStatement")
            # M15 positive incoming goods must work on existing returns/credit/refund
            # history without rewriting frozen sale prices or any cash allocations.
            from app.modules.stock_receipts.schemas import StockReceiptCreate
            from app.modules.stock_receipts.service import StockReceiptService

            before = session.execute(
                text('SELECT id,amount,"reversesEntryId" FROM dms.receivable_entry ORDER BY id')
            ).all()
            frozen = session.execute(
                text(
                    'SELECT l.id,l."unitPrice" FROM dms.document_line l '
                    'JOIN dms.document_revision r ON r.id=l."revisionId" '
                    "WHERE r.state='POSTED' ORDER BY l.id"
                )
            ).all()
            service = StockReceiptService(
                session, CursorCodec(b"x" * 32), 1, "mixed-history", lambda _: None
            )
            created = service.create(
                StockReceiptCreate(
                    businessDate="2026-06-01",
                    lines=[{"productId": "1", "quantity": "1", "unitPrice": "900"}],
                ),
                uuid4(),
            )
            posted = service.post(
                int(created.body["id"]), Preconditions(created.headers["ETag"]), uuid4()
            )
            assert posted.body["status"] == "POSTED"
            assert (
                session.execute(
                    text('SELECT id,amount,"reversesEntryId" FROM dms.receivable_entry ORDER BY id')
                ).all()
                == before
            )
            after = session.execute(
                text(
                    'SELECT l.id,l."unitPrice" FROM dms.document_line l '
                    'JOIN dms.document_revision r ON r.id=l."revisionId" '
                    "WHERE r.state='POSTED' AND r.\"documentId\"<>:id ORDER BY l.id"
                ),
                {"id": int(created.body["id"])},
            ).all()
            assert after == frozen


def test_draft_lines_parent_etags_ownership_rounding_and_last_line(engine, actor, product):
    with Session(engine) as session:
        core = DocumentService(session, CursorCodec(b"x" * 32), actor, "lines", lambda _: None)
        identifier = core.create_draft("STOCK_RECEIPT", date(2026, 10, 1), uuid4())
        body = DraftLine(
            kind="STOCK_RECEIPT", productId=product["id"], quantity="1.125", unitPrice="100"
        )
        first = core.create_line(
            identifier, 1, body, Preconditions(core.etag(core.get(identifier)))
        )
        assert first.lineAmount == 113
        before = core.etag(core.get(identifier))
        same_total = DraftLine(
            kind="STOCK_RECEIPT", productId=product["id"], quantity="0.565", unitPrice="200"
        )
        changed = core.replace_line(identifier, 1, int(first.id), same_total, Preconditions(before))
        assert changed.id == first.id and changed.lineNo == 1 and changed.lineAmount == 113
        assert core.etag(core.get(identifier)) != before
        with pytest.raises(ApiError) as missing_line:
            core.get_line(identifier, 1, 999999)
        assert missing_line.value.status == 404
        with pytest.raises(ApiError) as duplicate:
            core.create_line(identifier, 1, body, Preconditions(core.etag(core.get(identifier))))
        assert duplicate.value.code == "DUPLICATE_PRODUCT"
        other = core.create_draft("STOCK_RECEIPT", date(2026, 10, 1), uuid4())
        with pytest.raises(ApiError) as wrong:
            core.get_line(other, 1, int(first.id))
        assert wrong.value.status == 404
        core.delete_line(
            identifier, 1, int(first.id), Preconditions(core.etag(core.get(identifier)))
        )
        assert core.get(identifier).currentRevision.totalAmount == 0
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()


def test_financial_goods_immediate_and_dependency_guards(engine, actor, client, product):
    from tests.integration.catalogues.helpers import agency

    with Session(engine) as session:
        agency_id = agency(session)
        core = DocumentService(
            session, CursorCodec(b"x" * 32), actor, "kind-guards", lambda _: None
        )
        cash = core.create_draft(
            "PAYMENT_RECEIPT",
            date(2026, 10, 1),
            uuid4(),
            agencyId=agency_id,
            receiptType="DEBT_COLLECTION",
            paymentMethod="CASH",
        )
        body = DraftLine(
            kind="STOCK_RECEIPT", productId=product["id"], quantity="1", unitPrice="100"
        )
        with pytest.raises(ApiError) as error:
            core.create_line(cash, 1, body, Preconditions(core.etag(core.get(cash))))
        assert error.value.code == "LINE_CONFLICT"
        issue = core.create_draft("STOCK_ISSUE", date(2026, 10, 1), uuid4(), agencyId=agency_id)
        issue_body = body.model_copy(
            update={"kind": "STOCK_ISSUE", "basePurchasePrice": Decimal(100)}
        )
        line = core.create_line(issue, 1, issue_body, Preconditions(core.etag(core.get(issue))))
        session.execute(
            REVISION.update()
            .where(REVISION.c.id == int(core.get(issue).currentRevision.id))
            .values(immediatePayment=100)
        )
        match = Preconditions(core.etag(core.get(issue)))
        with pytest.raises(ApiError) as error:
            core.delete_line(issue, 1, int(line.id), match)
        assert error.value.code == "LINE_CONFLICT"
        with pytest.raises(DBAPIError) as dependency:
            core.draft(issue, 1, match, {})
        assert dependency.value.orig.sqlstate == "40001"
        adjustment = core.create_draft(
            "STOCK_ADJUSTMENT", date(2026, 10, 1), uuid4(), reason="Broken goods"
        )
        with pytest.raises(ApiError) as error:
            core.create_line(
                adjustment,
                1,
                body.model_copy(update={"kind": "STOCK_ADJUSTMENT"}),
                Preconditions(core.etag(core.get(adjustment))),
            )
        assert error.value.code == "LINE_CONFLICT"
        delta = body.model_copy(
            update={"kind": "STOCK_ADJUSTMENT", "unitPrice": Decimal(0), "quantity": Decimal(-1)}
        )
        core.create_line(adjustment, 1, delta, Preconditions(core.etag(core.get(adjustment))))
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()


def test_product_policy_checks_and_rollback_are_real(engine, actor, client, product):
    unit = client.post("/api/v1/units", json={"code": "OTHER", "name": "Other"}).json()["id"]
    other = client.post("/api/v1/products", json={"name": "Other", "unitId": unit}).json()
    with Session(engine) as session:
        core = DocumentService(session, CursorCodec(b"x" * 32), actor, "policy", lambda _: None)
        products = core.repo.lock_products([int(product["id"]), int(other["id"])])
        assert len(products) == 2
        with pytest.raises(ApiError) as missing:
            core.repo.lock_products([999999])
        assert missing.value.status == 404
        identifier = core.create_draft("STOCK_RECEIPT", date(2026, 10, 1), uuid4())
        assert core.repo.document(identifier, lock=False)["id"] == identifier
        body = DraftLine(
            kind="STOCK_RECEIPT", productId=product["id"], quantity="1", unitPrice="100"
        )
        core.create_line(identifier, 1, body, Preconditions(core.etag(core.get(identifier))))
        session.rollback()
    with engine.connect() as connection:
        assert connection.scalar(select(DOCUMENT.c.id).where(DOCUMENT.c.id == identifier)) is None
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.document_line").scalar() == 0
    detail = client.get("/api/v1/products/" + product["id"])
    client.patch(
        "/api/v1/products/" + product["id"],
        json={"status": "INACTIVE"},
        headers={"If-Match": detail.headers["ETag"]},
    )
    with Session(engine) as session:
        core = DocumentService(session, CursorCodec(b"x" * 32), actor, "policy", lambda _: None)
        with pytest.raises(ApiError) as inactive:
            core.repo.lock_products([int(product["id"])])
        assert inactive.value.code == "INACTIVE_MASTER"
        assert core.repo.lock_products([int(product["id"])], active=False)
        with pytest.raises(ApiError):
            core.repo.document(999999, lock=False)


def test_append_only_batches_are_caller_owned_and_validate_kind(engine, actor):
    with Session(engine) as session:
        core = DocumentService(session, CursorCodec(b"x" * 32), actor, "batches", lambda _: None)
        identifier = core.create_draft("STOCK_RECEIPT", date(2026, 10, 1), uuid4())
        revision_id = int(core.get(identifier).currentRevision.id)
        for kind in ("POST", "REVERSE", "REALLOCATE"):
            batch = core.repo.append_batch(revision_id, kind, uuid4(), actor)
            assert batch > 0
        with pytest.raises(ValueError):
            core.repo.append_batch(revision_id, "INVALID", uuid4(), actor)
        session.commit()
    with pytest.raises(DBAPIError), engine.begin() as connection:
        connection.exec_driver_sql("UPDATE dms.posting_batch SET kind='REVERSE'")
    with Session(engine) as session:
        core = DocumentService(session, CursorCodec(b"x" * 32), actor, "batches", lambda _: None)
        core.repo.append_batch(revision_id, "REALLOCATE", uuid4(), actor)
        session.rollback()
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.posting_batch").scalar() == 3


def test_provisional_issue_prices_require_a_source_and_storable_quote(engine, actor, product):
    from tests.integration.catalogues.helpers import draft, install_builders, post_stock

    with Session(engine) as session:
        core = DocumentService(
            session, CursorCodec(b"x" * 32), actor, "issue-price", lambda _: None
        )
        with pytest.raises(ApiError) as absent:
            core.prepare_issue_line(int(product["id"]), "1")
        assert absent.value.code == "PRICE_SOURCE_REQUIRED"
        with pytest.raises(ApiError) as missing:
            core.prepare_issue_line(999999, "1")
        assert missing.value.status == 404
        install_builders(session, actor)
        receipt = draft(session, int(product["id"]), quantity="10")
        post_stock(session, receipt)
        session.commit()
        prepared = core.prepare_issue_line(int(product["id"]), "1.125")
        assert prepared.unitPrice == 102 and prepared.basePurchasePrice == 100
        assert prepared.quantity == Decimal("1.125")
        session.execute(text('UPDATE dms.business_rule SET "sellingPriceRate"=0.000001 WHERE id'))
        with pytest.raises(ApiError) as unusable:
            core.prepare_issue_line(int(product["id"]), "1")
        assert unusable.value.code == "SELLING_PRICE_UNUSABLE"
        session.rollback()


@pytest.mark.parametrize("state", ["READY", "POSTED"])
def test_all_line_mutations_reject_frozen_revisions_without_persisted_effects(
    client, engine, actor, product, state
):
    from tests.integration.catalogues.helpers import agency, draft, install_builders, post_stock
    from tests.integration.documents.test_receipts import post_receipt, receipt

    opening = receipt(client, product, business_date="2026-01-01", quantity="10")
    assert post_receipt(client, opening).status_code == 200
    with Session(engine) as session:
        install_builders(session, actor)
        agency_id = agency(session)
        issue = draft(
            session, int(product["id"]), quantity="3", kind="STOCK_ISSUE", agency_id=agency_id
        )
        session.execute(text("SELECT pg_temp.ready(:id)"), {"id": issue})
        if state == "POSTED":
            post_stock(session, issue)
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()
        core = DocumentService(session, CursorCodec(b"x" * 32), actor, "frozen", lambda _: None)
        before = core.get(issue)
        lines = before.currentRevision.lines
        condition = Preconditions(core.etag(before))
        body = DraftLine(
            kind="STOCK_ISSUE",
            productId=product["id"],
            quantity="1",
            unitPrice="102",
            basePurchasePrice="100",
        )
        ledger = session.execute(
            text("SELECT id,quantity FROM dms.inventory_entry ORDER BY id")
        ).all()
        for operation in (
            lambda: core.create_line(issue, 1, body, condition),
            lambda: core.replace_line(issue, 1, int(lines[0].id), body, condition),
            lambda: core.delete_line(issue, 1, int(lines[0].id), condition),
        ):
            with pytest.raises(ApiError) as error:
                operation()
            assert error.value.code == "STATE_CONFLICT"
        session.commit()
        assert core.get(issue) == before
        assert (
            session.execute(text("SELECT id,quantity FROM dms.inventory_entry ORDER BY id")).all()
            == ledger
        )
        assert core.get(issue).currentRevision.totalAmount == 306
