from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError
from app.modules.settlement_core.repository import SettlementRepository
from app.modules.settlement_core.reservations import ReservationService
from tests.integration.catalogues.helpers import install_builders
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.settlement_core.helpers import (
    commit,
    financial,
    issue,
    mark_posted,
    service,
)

pytestmark = pytest.mark.integration


def credit_cash(session, actor, trading, amount=100):
    """Confirmed separate cash, linked to a real READY issue, with no fake sale/debt."""
    install_builders(session, actor)
    session.execute(text("SET CONSTRAINTS ALL DEFERRED"))
    pending = session.scalar(
        text("""
        SELECT pg_temp.stock_draft('STOCK_ISSUE',:agency,DATE '2026-01-02',
          jsonb_build_array(jsonb_build_object('product',CAST(:product AS bigint),
            'quantity',3)),gen_random_uuid())
    """),
        {"agency": trading[0], "product": trading[1]},
    )
    session.execute(text("SELECT pg_temp.ready(:id,:amount)"), {"id": pending, "amount": amount})
    confirmation = session.scalar(
        text("""
        INSERT INTO dms.upfront_confirmation ("issueRevisionId",amount,method,"receivedAt",
          "verifiedBy","evidenceReference") SELECT "currentRevisionId",:amount,'CASH',
            TIMESTAMPTZ '2026-01-03 10:00:00+07',:actor,'separate-local-cash'
          FROM dms.document WHERE id=:id RETURNING id
    """),
        {"amount": amount, "actor": actor, "id": pending},
    )
    receipt = financial(session, actor, trading[0], amount, receipt="RECEIVED_UNAPPLIED")
    plan = service(session, actor).post_receipt(receipt, uuid4())
    session.execute(
        text("""
        UPDATE dms.upfront_confirmation SET state='RECEIVED_SEPARATELY',"receiptDocumentId"=:receipt
        WHERE id=:id
    """),
        {"id": confirmation, "receipt": receipt},
    )
    return receipt, plan


def refund(session, actor, agency_id, receipt, amount=100, *, method="CASH"):
    return financial(
        session,
        actor,
        agency_id,
        amount,
        kind="REFUND",
        receipt=None,
        method=method,
        origin=receipt,
        day=5,
    )


def reservations(session, actor):
    return ReservationService(session, actor, "reservation-test", lambda _: None)


def test_separate_receipt_split_reserve_release_once_and_rollback(engine, actor, trading):
    with Session(engine) as session:
        issue(session, actor, trading)
        receipt, plan = credit_cash(session, actor, trading, 200)
        commit(session)
        assert plan.debt == 0 and plan.credit == 98
        identifier = refund(session, actor, trading[0], receipt, 98)
        commit(session)
        allocated = reservations(session, actor).reserve(identifier)
        assert sum(amount for _, amount in allocated) == 98
        commit(session)
        repo = SettlementRepository(session)
        assert repo.balance(trading[0])["reserved"] == 98
        assert repo.available(trading[0], receipt_id=receipt)[0]["available"] == 0
        assert repo.available(trading[0], receipt_id=99999) == []
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            reservations(session, actor).reserve(identifier)
        reservations(session, actor).release(identifier)
        session.rollback()
        assert repo.balance(trading[0])["reserved"] == 98
        reservations(session, actor).release(identifier)
        commit(session)
        assert repo.balance(trading[0])["reserved"] == 0
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            reservations(session, actor).release(identifier)
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            reservations(session, actor).consume(identifier, uuid4())


def test_consumed_refund_preserves_exact_lots_and_cannot_be_consumed_twice(engine, actor, trading):
    with Session(engine) as session:
        receipt, _ = credit_cash(session, actor, trading)
        commit(session)
        identifier = refund(session, actor, trading[0], receipt, 60)
        allocations = reservations(session, actor).reserve(identifier)
        commit(session)
        mark_posted(session, actor, identifier)
        plan = reservations(session, actor).consume(identifier, uuid4())
        commit(session)
        assert plan.credit == 40 and plan.debt == 0
        repo = SettlementRepository(session)
        rows = repo.reservations(repo.source(identifier)["revisionId"])
        assert rows[0]["state"] == "CONSUMED" and rows[0]["lotId"] == allocations[0][0]
        entries = repo.effective(repo.source(identifier)["revisionId"], "credit")
        assert entries[0]["lotId"] == allocations[0][0] and entries[0]["amount"] == -60
        before = session.execute(
            text("SELECT to_jsonb(e) FROM dms.credit_entry e ORDER BY id")
        ).all()
        service(session, actor).replay(trading[0], uuid4(), permission="cash.receipt.post")
        commit(session)
        assert (
            session.execute(text("SELECT to_jsonb(e) FROM dms.credit_entry e ORDER BY id")).all()
            == before
        )
        for operation in (
            lambda: reservations(session, actor).consume(identifier, uuid4()),
            lambda: reservations(session, actor).release(identifier),
        ):
            with pytest.raises(ApiError, match="STATE_CONFLICT"):
                operation()


def test_credit_application_and_reservation_both_winner_orders_exclude_double_spend(
    engine, actor, trading
):
    with Session(engine) as session:
        receipt, _ = credit_cash(session, actor, trading)
        issue(session, actor, trading, day=4)
        application = financial(
            session,
            actor,
            trading[0],
            100,
            day=5,
            kind="CREDIT_APPLICATION",
            receipt=None,
            method=None,
        )
        requested = refund(session, actor, trading[0], receipt)
        commit(session)

    def reserve(session):
        value = reservations(session, actor).reserve(requested)
        commit(session)
        return value

    def apply(session):
        core = service(session, actor)
        core.lock(trading[0], "credit.apply")
        mark_posted(session, actor, application)
        plan = core.replay(trading[0], uuid4(), permission="credit.apply")
        commit(session)
        return plan.credit

    first, second = ordered_race(engine, reserve, apply)
    assert first and second == "INSUFFICIENT_CREDIT"
    with Session(engine) as session:
        assert SettlementRepository(session).source(application)["status"] == "DRAFT"
        reservations(session, actor).release(requested)
        commit(session)
        requested2 = refund(session, actor, trading[0], receipt)
        commit(session)

    def reserve_second(session):
        value = reservations(session, actor).reserve(requested2)
        commit(session)
        return value

    first, second = ordered_race(engine, apply, reserve_second)
    assert first == 0 and second == "INSUFFICIENT_CREDIT"
    with Session(engine) as session:
        assert SettlementRepository(session).balance(trading[0])["debt"] == 2
        assert SettlementRepository(session).balance(trading[0])["credit"] == 0


def test_two_reservations_compete_one_winner(engine, actor, trading):
    with Session(engine) as session:
        receipt, _ = credit_cash(session, actor, trading)
        first = refund(session, actor, trading[0], receipt, 80)
        second = refund(session, actor, trading[0], receipt, 80)
        commit(session)

    def reserve(session, identifier):
        result = reservations(session, actor).reserve(identifier)
        commit(session)
        return result

    lead, follow = ordered_race(engine, lambda s: reserve(s, first), lambda s: reserve(s, second))
    assert sum(amount for _, amount in lead) == 80 and follow == "INSUFFICIENT_CREDIT"
    with Session(engine) as session:
        assert SettlementRepository(session).balance(trading[0])["reserved"] == 80


def test_reservation_source_cash_cap_and_full_consumption_guards(engine, actor, trading):
    with Session(engine) as session:
        receipt, _ = credit_cash(session, actor, trading)
        identifier = refund(session, actor, trading[0], receipt, 50)
        commit(session)
        with pytest.raises(ApiError, match="REFUND_SOURCE_CONFLICT"):
            reservations(session, actor).refund(receipt)
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            reservations(session, actor).release(identifier)
        real_source = SettlementRepository(session).source

        def wrong_source(document_id):
            row = real_source(document_id)
            if document_id == receipt:
                row["agencyId"] = 999
            return row

        with (
            patch.object(SettlementRepository, "source", side_effect=wrong_source),
            pytest.raises(ApiError, match="REFUND_SOURCE_CONFLICT"),
        ):
            reservations(session, actor).refund(identifier)
        real_scalar = session.scalar

        def exhausted(query, *args, **kwargs):
            if "FILTER(WHERE d.status='POSTED')" in str(query):
                return Decimal(100)
            return real_scalar(query, *args, **kwargs)

        with (
            patch.object(session, "scalar", side_effect=exhausted),
            pytest.raises(ApiError, match="REFUND_SOURCE_CONFLICT"),
        ):
            reservations(session, actor).reserve(identifier)
        allocations = reservations(session, actor).reserve(identifier)
        commit(session)
        mark_posted(session, actor, identifier)
        with (
            patch.object(
                SettlementRepository,
                "reservations",
                return_value=[
                    {"state": "ACTIVE", "amount": Decimal(49), "lotId": allocations[0][0]}
                ],
            ),
            pytest.raises(ApiError, match="REFUND_SOURCE_CONFLICT"),
        ):
            reservations(session, actor).consume(identifier, uuid4())
        session.rollback()


def test_unknown_online_attempt_retains_reservation(engine, actor, trading):
    with Session(engine) as session:
        issue(session, actor, trading, quantity=3)
        commit(session)
        payment = session.scalar(
            text("""
            INSERT INTO dms.online_payment ("agencyId",provider,"merchantReference",
              "idempotencyKey",
              amount,"expiresAt","createdBy") VALUES (:agency,'LOCAL_TEST','unknown-source',
              gen_random_uuid(),200,clock_timestamp()+interval '1 day',:actor) RETURNING id
        """),
            {"agency": trading[0], "actor": actor},
        )
        manual = financial(session, actor, trading[0], 200)
        service(session, actor).post_receipt(manual, uuid4())
        online = financial(session, actor, trading[0], 200, day=4, method="ONLINE")
        service(session, actor).post_receipt(online, uuid4())
        session.execute(
            text("""
            INSERT INTO dms.payment_event
              ("paymentId","eventKey","providerStatus","verifiedPayload")
              VALUES (:id,'unknown-source-success','SUCCESS','{}')
        """),
            {"id": payment},
        )
        session.execute(
            text("""
            UPDATE dms.online_payment SET status='SUCCESS',"receiptDocumentId"=:receipt,
              "providerTransactionId"='unknown-source-success',"paymentTime"=clock_timestamp()
            WHERE id=:id
        """),
            {"id": payment, "receipt": online},
        )
        identifier = refund(session, actor, trading[0], online, 90, method="ONLINE")
        reservations(session, actor).reserve(identifier)
        revision = SettlementRepository(session).source(identifier)["revisionId"]
        attempt = session.scalar(
            text("""
            INSERT INTO dms.refund_attempt ("refundRevisionId","onlinePaymentId","idempotencyKey",
              "merchantRefundReference",amount) VALUES (:revision,:payment,
              gen_random_uuid(),'unknown-local-refund',90) RETURNING id
        """),
            {"revision": revision, "payment": payment, "actor": actor},
        )
        session.execute(
            text("UPDATE dms.refund_attempt SET state='UNKNOWN' WHERE id=:id"), {"id": attempt}
        )
        commit(session)
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            reservations(session, actor).release(identifier)
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            reservations(session, actor).reserve(identifier)
        assert SettlementRepository(session).balance(trading[0])["reserved"] == 90
