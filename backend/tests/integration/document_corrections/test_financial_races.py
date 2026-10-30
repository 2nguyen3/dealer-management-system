from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.credit_applications.schemas import CreditApplicationCorrection
from app.modules.credit_applications.service import CreditApplicationService
from app.modules.document_corrections.credit import CreditCorrectionService
from app.modules.document_corrections.returns import ReturnCorrectionService
from app.modules.sales_returns.schemas import SalesReturnCorrection, SalesReturnCreate
from app.modules.stock_counts.schemas import StockCountCreate
from app.modules.stock_counts.service import StockCountService
from app.modules.stock_receipts.schemas import Reason
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.document_corrections.helpers import snapshot
from tests.integration.document_corrections.test_issues import replacement
from tests.integration.document_corrections.test_issues import use_case as issue_corrections
from tests.integration.document_corrections.test_return_credit import match, post_return, returns
from tests.integration.settlement_core.helpers import commit, financial, issue, service
from tests.integration.settlement_core.test_reservations import credit_cash, refund, reservations

pytestmark = pytest.mark.integration


def applications(session, actor):
    return CreditApplicationService(
        session, CursorCodec(b"x" * 32), actor, "m29-financial-race", lambda _: None
    )


def assert_failed_command_absent(after, key):
    assert all(row["clientKey"] != key for row in after["api_idempotency"])


@pytest.mark.parametrize("leading", ["cancel", "return"])
def test_issue_cancel_vs_return_post_observes_both_winners(engine, actor, trading, leading):
    with Session(engine) as session:
        origin = issue(session, actor, trading, quantity=3)
        commit(session)
        owner = returns(session, actor)
        line = owner.core.repo.lines(owner.core.repo.document(origin)["currentRevisionId"])[0]
        draft = owner.create(
            SalesReturnCreate(
                originDocumentId=str(origin),
                businessDate="2026-01-03",
                lines=[{"originLineId": str(line["id"]), "quantity": "1"}],
            ),
            uuid4(),
        )
        identifier = int(draft.body["id"])
        token = match(issue_corrections(session, actor).owner, origin)
    before = snapshot(engine)
    cancel_key, return_key = uuid4(), uuid4()

    def cancel(session):
        return issue_corrections(session, actor).cancel(
            origin, Reason(reason="No delivery"), token, cancel_key
        )

    def post(session):
        return returns(session, actor).post(
            identifier, Preconditions(draft.headers["ETag"]), return_key
        )

    first, second = ordered_race(
        engine, cancel if leading == "cancel" else post, post if leading == "cancel" else cancel
    )
    assert first.body["status"] == ("CANCELLED" if leading == "cancel" else "POSTED")
    assert second == ("RETURN_SOURCE_CONFLICT" if leading == "cancel" else "PRECONDITION_FAILED")
    after = snapshot(engine)
    documents = {row["id"]: row for row in after["document"]}
    assert documents[origin]["status"] == ("CANCELLED" if leading == "cancel" else "POSTED")
    assert documents[identifier]["status"] == ("DRAFT" if leading == "cancel" else "POSTED")
    assert after["agency_balance"][0]["currentDebt"] == (0 if leading == "cancel" else 204)
    assert after["inventory_balance"][0]["currentStock"] == (1000 if leading == "cancel" else 998)
    assert len(after["document_revision"]) == len(before["document_revision"])
    if leading == "cancel":
        assert after["document_revision"] == before["document_revision"]
    assert len(after["api_idempotency"]) == len(before["api_idempotency"]) + 1
    assert_failed_command_absent(after, return_key if leading == "cancel" else cancel_key)
    if leading == "return":
        with Session(engine) as session, pytest.raises(ApiError, match="RETURN_SOURCE_CONFLICT"):
            correction = issue_corrections(session, actor)
            correction.cancel(
                origin, Reason(reason="No delivery"), match(correction.owner, origin), uuid4()
            )
        assert snapshot(engine) == after


@pytest.mark.parametrize("leading", ["correction", "credit"])
def test_return_reduction_vs_credit_post_observes_both_winners(engine, actor, trading, leading):
    with Session(engine) as session:
        origin = issue(session, actor, trading, quantity=3)
        cash = financial(session, actor, trading[0], 306)
        service(session, actor).post_receipt(cash, uuid4())
        commit(session)
        owner = returns(session, actor)
        line = owner.core.repo.lines(owner.core.repo.document(origin)["currentRevisionId"])[0]
        identifier = post_return(owner, origin, line["id"], "2", "2026-01-04")
        issue(session, actor, trading, quantity=3, day=4)
        application = financial(
            session,
            actor,
            trading[0],
            150,
            day=5,
            kind="CREDIT_APPLICATION",
            receipt=None,
            method=None,
        )
        commit(session)
        return_token, credit_token = (
            match(owner, identifier),
            match(applications(session, actor), application),
        )
    before = snapshot(engine)
    correction_key, credit_key = uuid4(), uuid4()

    def correct(session):
        return ReturnCorrectionService(returns(session, actor)).correct(
            identifier,
            SalesReturnCorrection(
                businessDate="2026-01-04",
                reason="Only one item returned",
                lines=[{"originLineId": str(line["id"]), "quantity": "1"}],
            ),
            return_token,
            correction_key,
        )

    def post(session):
        return applications(session, actor).post(application, credit_token, credit_key)

    first, second = ordered_race(
        engine,
        correct if leading == "correction" else post,
        post if leading == "correction" else correct,
    )
    assert first.body["status"] == "POSTED"
    assert second == "INSUFFICIENT_CREDIT"
    after = snapshot(engine)
    balance = after["agency_balance"][0]
    assert (balance["currentDebt"], balance["currentCredit"]) == (
        (306, 102) if leading == "correction" else (156, 54)
    )
    assert len(after["document_revision"]) == len(before["document_revision"]) + (
        leading == "correction"
    )
    assert after["credit_lot"] == before["credit_lot"]
    assert len(after["api_idempotency"]) == len(before["api_idempotency"]) + 1
    assert_failed_command_absent(after, credit_key if leading == "correction" else correction_key)
    documents = {row["id"]: row for row in after["document"]}
    assert documents[application]["status"] == ("DRAFT" if leading == "correction" else "POSTED")
    assert documents[identifier]["currentRevisionId"] == (
        after["document_revision"][-1]["id"]
        if leading == "correction"
        else next(row["currentRevisionId"] for row in before["document"] if row["id"] == identifier)
    )


@pytest.mark.parametrize("leading", ["correction", "reservation"])
def test_credit_increase_vs_refund_reservation_observes_both_winners(
    engine, actor, trading, leading
):
    with Session(engine) as session:
        cash, _ = credit_cash(session, actor, trading, 100)
        issue(session, actor, trading, quantity=3, day=4)
        identifier = financial(
            session,
            actor,
            trading[0],
            20,
            day=5,
            kind="CREDIT_APPLICATION",
            receipt=None,
            method=None,
        )
        commit(session)
        owner = applications(session, actor)
        owner.post(identifier, match(owner, identifier), uuid4())
        requested = refund(session, actor, trading[0], cash, 60)
        commit(session)
        token = match(owner, identifier)
    before = snapshot(engine)
    key = uuid4()

    def correct(session):
        return CreditCorrectionService(applications(session, actor)).correct(
            identifier,
            CreditApplicationCorrection(
                businessDate="2026-01-05", amount="60", reason="Wrong offset"
            ),
            token,
            key,
        )

    def reserve(session):
        allocated = reservations(session, actor).reserve(requested)
        commit(session)
        return allocated

    first, second = ordered_race(
        engine,
        correct if leading == "correction" else reserve,
        reserve if leading == "correction" else correct,
    )
    assert second == "INSUFFICIENT_CREDIT"
    if leading == "correction":
        assert first.body["revisionNo"] == 2
    else:
        assert sum(amount for _, amount in first) == 60
    after = snapshot(engine)
    balance = after["agency_balance"][0]
    assert (balance["currentDebt"], balance["currentCredit"]) == (
        (246, 40) if leading == "correction" else (286, 80)
    )
    assert after["credit_lot"] == before["credit_lot"]
    assert after["inventory_entry"] == before["inventory_entry"]
    assert len(after["document_revision"]) == len(before["document_revision"]) + (
        leading == "correction"
    )
    assert len(after["api_idempotency"]) == len(before["api_idempotency"]) + (
        leading == "correction"
    )
    assert len(after["refund_reservation"]) == (0 if leading == "correction" else 1)
    if leading == "reservation":
        assert after["refund_reservation"][0]["state"] == "ACTIVE"
        assert after["refund_reservation"][0]["amount"] == 60
        assert_failed_command_absent(after, key)
        for table in (
            "document",
            "document_revision",
            "posting_batch",
            "receivable_entry",
            "credit_entry",
        ):
            assert after[table] == before[table]


def test_issue_correction_vs_count_confirmation_observes_both_winners(engine, actor, trading):
    with Session(engine) as session:
        identifier = issue(session, actor, trading, quantity=3)
        commit(session)

    def counts(session):
        return StockCountService(
            session, CursorCodec(b"x" * 32), actor, "m29-count-race", lambda _: None
        )

    for leading, quantity, stock in (("count", "2", 997), ("correction", "1", 998)):
        with Session(engine) as session:
            counted = counts(session).create(
                StockCountCreate(
                    countedAt="2026-01-06T10:00:00Z",
                    reason="Independent physical count",
                    lines=[{"productId": str(trading[1]), "countedQuantity": str(stock)}],
                ),
                uuid4(),
            )
            token = match(issue_corrections(session, actor).owner, identifier)
        before = snapshot(engine)
        key = uuid4()

        def correct(session, quantity=quantity, token=token):
            return issue_corrections(session, actor).correct(
                identifier, replacement(trading[1], quantity), token, uuid4()
            )

        def confirm(session, counted=counted, key=key):
            return counts(session).confirm(
                int(counted.body["id"]), Preconditions(counted.headers["ETag"]), key
            )

        first, second = ordered_race(
            engine,
            confirm if leading == "count" else correct,
            correct if leading == "count" else confirm,
        )
        if leading == "count":
            assert first.body["state"] == "CONFIRMED" and first.body["adjustmentDocumentId"] is None
            assert second.body["revisionNo"] == 2
        else:
            assert first.body["revisionNo"] == 3 and second == "STALE_STOCK_SNAPSHOT"
        after = snapshot(engine)
        assert after["inventory_balance"][0]["currentStock"] == stock + 1
        assert len(after["document_revision"]) == len(before["document_revision"]) + 1
        assert len(after["document"]) == len(before["document"])
        assert len(after["api_idempotency"]) == len(before["api_idempotency"]) + (
            2 if leading == "count" else 1
        )
        with engine.connect() as connection:
            row = connection.execute(
                text('SELECT state,"adjustmentDocumentId" FROM dms.stock_count WHERE id=:id'),
                {"id": int(counted.body["id"])},
            ).one()
            assert row == ("CONFIRMED" if leading == "count" else "DRAFT", None)
        if leading == "correction":
            assert_failed_command_absent(after, key)
