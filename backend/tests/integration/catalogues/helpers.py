from pathlib import Path

from sqlalchemy import text

from app.common.pagination import CursorCodec
from app.core.request_context import set_audit_context
from tests.integration.catalogues.conftest import CASES


def service_for(resource, session, actor, request="race-request"):
    return CASES[resource][0](session, CursorCodec(b"x" * 32), actor, request, lambda _: None)


def install_builders(session, actor):
    sql = Path("app/db/sql/seed_helpers.sql").read_text(encoding="utf-8")
    if not session.scalar(text("SELECT to_regprocedure('pg_temp.actor()')")):
        session.connection().connection.driver_connection.execute(sql, prepare=False)
    set_audit_context(session, actor, "fixture", function_code="stock.receipt.post")


def agency(session, district=1, type_id=1):
    if not session.scalar(text("SELECT id FROM dms.district WHERE id=:id"), {"id": district}):
        assert (
            session.scalar(
                text("INSERT INTO dms.district (code,name) VALUES ('BASE','Base') RETURNING id")
            )
            == district
        )
    return session.scalar(
        text(
            'INSERT INTO dms.agency (name,"typeId","districtId",email,"acceptedDate") '
            "VALUES ('Agency',:type,:district,'agency@example.com','2026-01-01') RETURNING id"
        ),
        {"type": type_id, "district": district},
    )


def product(session, unit=1):
    return session.scalar(
        text("INSERT INTO dms.product (name,\"unitId\") VALUES ('Product',:unit) RETURNING id"),
        {"unit": unit},
    )


def draft(session, product_id, *, quantity="1", kind="STOCK_RECEIPT", agency_id=None):
    session.execute(text("SET CONSTRAINTS ALL DEFERRED"))
    return session.scalar(
        text(
            "SELECT pg_temp.stock_draft(:kind,:agency,DATE '2026-01-02',"
            "jsonb_build_array(jsonb_build_object('product',CAST(:product AS bigint),"
            "'quantity',CAST(:quantity AS numeric),'price',100)),gen_random_uuid())"
        ),
        {"kind": kind, "agency": agency_id, "product": product_id, "quantity": quantity},
    )


def post_stock(session, document_id):
    session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": document_id})
    session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))


def count_line(session, actor, product_id, unit_id, counted="0"):
    identifier = session.scalar(
        text(
            'INSERT INTO dms.stock_count ("countedAt","createdBy") '
            "VALUES (clock_timestamp(),:actor) RETURNING id"
        ),
        {"actor": actor},
    )
    return session.scalar(
        text(
            'INSERT INTO dms.stock_count_line ("countId","productId","unitId",'
            '"bookQuantity","countedQuantity") VALUES (:id,:product,:unit,0,:counted) RETURNING id'
        ),
        {"id": identifier, "product": product_id, "unit": unit_id, "counted": counted},
    )
