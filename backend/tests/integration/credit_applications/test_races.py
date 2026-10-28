from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.credit_applications.test_service import create, service
from tests.integration.settlement_core.helpers import commit, issue
from tests.integration.settlement_core.test_reservations import credit_cash, refund, reservations

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("first", ["reserve", "apply"])
def test_application_vs_reservation_both_winners(engine, actor, trading, first):
    agency, product = int(trading["agency"]), int(trading["product"])
    with Session(engine) as session:
        receipt, _ = credit_cash(session, actor, (agency, product), 100)
        issue(session, actor, (agency, product), day=4)
        requested = refund(session, actor, agency, receipt)
        commit(session)
        application = create(service(session, actor), agency)

    def apply(session):
        return (
            service(session, actor)
            .post(int(application.body["id"]), Preconditions(application.headers["ETag"]), uuid4())
            .body["agencyBalance"]["currentCredit"]
        )

    def reserve(session):
        result = reservations(session, actor).reserve(requested)
        commit(session)
        return result

    if first == "reserve":
        leading, following = ordered_race(engine, reserve, apply)
        assert leading and following == "INSUFFICIENT_CREDIT"
    else:
        leading, following = ordered_race(engine, apply, reserve)
        assert leading == "0" and following == "INSUFFICIENT_CREDIT"
    with engine.connect() as connection:
        credit = connection.scalar(text('SELECT "currentCredit" FROM dms.agency_balance'))
        reserved = connection.scalar(
            text("SELECT coalesce(sum(amount),0) FROM dms.refund_reservation WHERE state='ACTIVE'")
        )
        assert (credit, reserved) == ((100, 100) if first == "reserve" else (0, 0))


def test_competing_applications_one_winner(engine, actor, trading):
    agency, product = int(trading["agency"]), int(trading["product"])
    with Session(engine) as session:
        credit_cash(session, actor, (agency, product), 100)
        issue(session, actor, (agency, product), day=4, quantity=2)
        commit(session)
        applications = [create(service(session, actor), agency) for _ in range(2)]

    def apply(session, value):
        return (
            service(session, actor)
            .post(int(value.body["id"]), Preconditions(value.headers["ETag"]), uuid4())
            .body["agencyBalance"]["currentDebt"]
        )

    leading, following = ordered_race(
        engine, lambda s: apply(s, applications[0]), lambda s: apply(s, applications[1])
    )
    assert leading == "104" and following == "INSUFFICIENT_CREDIT"
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text(
                    "SELECT count(*) FROM dms.document "
                    "WHERE kind='CREDIT_APPLICATION' AND status='POSTED'"
                )
            )
            == 1
        )
