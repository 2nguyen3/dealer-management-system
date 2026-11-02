from datetime import date
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import text

from app.modules.document_core.repository import DocumentRepository
from app.modules.settlement_core.service import SettlementService
from tests.integration.catalogues.helpers import install_builders


def issue(session, actor, trading, *, day=2, quantity=1, post=True):
    install_builders(session, actor)
    session.execute(text("SET CONSTRAINTS ALL DEFERRED"))
    agency, product = trading
    identifier = session.scalar(
        text("""
        SELECT pg_temp.stock_draft('STOCK_ISSUE',:agency,:day,
          jsonb_build_array(jsonb_build_object('product',CAST(:product AS bigint),
            'quantity',CAST(:qty AS numeric))),gen_random_uuid())
    """),
        {"agency": agency, "product": product, "qty": quantity, "day": date(2026, 1, day)},
    )
    session.execute(text("SELECT pg_temp.ready(:id)"), {"id": identifier})
    if post:
        session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": identifier})
    return identifier


def financial(
    session,
    actor,
    agency,
    amount,
    *,
    day=3,
    kind="PAYMENT_RECEIPT",
    receipt="DEBT_COLLECTION",
    method="CASH",
    origin=None,
):
    install_builders(session, actor)
    session.execute(text("SET CONSTRAINTS ALL DEFERRED"))
    return session.scalar(
        text("""
        SELECT pg_temp.financial(:kind,:agency,:day,:amount,:method,:receipt,:origin,
          gen_random_uuid(),false)
    """),
        {
            "kind": kind,
            "agency": agency,
            "day": date(2026, 1, day),
            "amount": Decimal(amount),
            "method": method,
            "receipt": receipt,
            "origin": origin,
        },
    )


def service(session, actor, authorize=lambda _: None):
    return SettlementService(session, actor, "settlement-test", authorize)


def commit(session):
    session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
    session.commit()


def mark_posted(session, actor, identifier, *, key=None):
    source = DocumentRepository(session).document(identifier)
    session.execute(
        text("UPDATE dms.document SET status='POSTED' WHERE id=:id"), {"id": identifier}
    )
    session.execute(
        text("""
        UPDATE dms.document_revision SET state='POSTED',"postedBy"=:actor,
          "postedAt"=clock_timestamp() WHERE id=:id
    """),
        {"id": source["currentRevisionId"], "actor": actor},
    )
    DocumentRepository(session).append_batch(
        source["currentRevisionId"], "POST", key or uuid4(), actor
    )
