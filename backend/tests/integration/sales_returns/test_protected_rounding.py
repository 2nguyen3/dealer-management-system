from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.integration.catalogues.helpers import install_builders, product
from tests.integration.sales_returns.test_returns import create, issue, post
from tests.integration.settlement_core.helpers import commit, mark_posted
from tests.integration.settlement_core.test_reservations import refund, reservations

pytestmark = pytest.mark.integration


def fractional_trading(engine, actor, trading):
    with Session(engine) as session:
        install_builders(session, actor)
        unit = session.scalar(
            text(
                'INSERT INTO dms.unit (code,name,"allowsFraction") '
                "VALUES ('KG','Kilogram',true) RETURNING id"
            )
        )
        identifier = product(session, unit)
        opening = session.scalar(
            text(
                """SELECT pg_temp.stock_draft('STOCK_RECEIPT',NULL,DATE '2026-01-01',
                jsonb_build_array(jsonb_build_object('product',CAST(:id AS bigint),
                  'quantity',100,'price',1)),gen_random_uuid())"""
            ),
            {"id": identifier},
        )
        session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": opening})
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()
    return {**trading, "product": str(identifier), "unit": unit}


@pytest.mark.parametrize("state", ["reserved", "paid"])
def test_protected_rounding_reproduction(client, engine, actor, trading, state):
    trading = fractional_trading(engine, actor, trading)
    source = issue(client, trading, "3")
    receipt = client.post(
        "/api/v1/payment-receipts",
        json={
            "agencyId": trading["agency"],
            "businessDate": "2026-01-03",
            "amount": "3",
            "paymentMethod": "CASH",
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert receipt.status_code == 201, receipt.text
    paid = client.post(
        receipt.headers["Location"] + "/post",
        headers={"If-Match": receipt.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert paid.status_code == 200, paid.text
    late = create(client, source, "2.5", "2026-01-05")
    assert post(client, late).status_code == 200
    with Session(engine) as session:
        install_builders(session, actor)
        requested = refund(session, actor, int(trading["agency"]), int(receipt.json()["id"]), 1)
        reservations(session, actor).reserve(requested)
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()
        if state == "paid":
            mark_posted(session, actor, requested)
            reservations(session, actor).consume(requested, uuid4())
            commit(session)
    old = client.get(late.headers["Location"]).json()["currentRevision"]
    early = create(client, source, "0.5", "2026-01-04")
    result = post(client, early)
    assert result.status_code == 200, result.text
    newer = client.get(late.headers["Location"]).json()["currentRevision"]
    assert newer["totalAmount"] == "2" and newer["revisionNo"] == 2
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text('SELECT "totalAmount" FROM dms.document_revision WHERE id=:id'),
                {"id": int(old["id"])},
            )
            == 3
        )
        assert connection.scalar(
            text("SELECT coalesce(sum(amount),0) FROM dms.refund_reservation WHERE state='ACTIVE'")
        ) == (1 if state == "reserved" else 0)
        lot = connection.execute(
            text(
                'SELECT l."sourceRevisionId",sum(e.amount) AS balance FROM dms.credit_lot l '
                'JOIN dms.credit_entry e ON e."lotId"=l.id '
                'WHERE l."sourceRevisionId"=:id GROUP BY l.id'
            ),
            {"id": int(old["id"])},
        ).one()
        assert lot.sourceRevisionId == int(old["id"]) and lot.balance == (
            2 if state == "reserved" else 1
        )
