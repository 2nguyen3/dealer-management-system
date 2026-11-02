from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.credit_applications.schemas import (
    CreditApplicationCorrection,
    CreditApplicationCreate,
)
from app.modules.credit_applications.service import CreditApplicationService
from app.modules.document_corrections.credit import CreditCorrectionService
from app.modules.document_corrections.returns import ReturnCorrectionService
from app.modules.sales_returns.schemas import SalesReturnCorrection, SalesReturnCreate
from app.modules.sales_returns.service import SalesReturnService
from app.modules.stock_receipts.schemas import Reason
from tests.integration.document_corrections.helpers import snapshot
from tests.integration.document_corrections.test_issues import replacement
from tests.integration.document_corrections.test_issues import use_case as issue_corrections
from tests.integration.sales_returns.test_protected_rounding import fractional_trading
from tests.integration.settlement_core.helpers import commit, issue
from tests.integration.settlement_core.test_reservations import credit_cash

pytestmark = pytest.mark.integration


def returns(session, actor):
    return SalesReturnService(session, CursorCodec(b"x" * 32), actor, "m29-return", lambda _: None)


def match(owner, identifier):
    return Preconditions(owner.etag(owner.core.get(identifier, check_permission=False)))


def post_return(owner, origin, line, quantity, day):
    created = owner.create(
        SalesReturnCreate(
            originDocumentId=str(origin),
            businessDate=day,
            lines=[{"originLineId": str(line), "quantity": quantity}],
        ),
        uuid4(),
    )
    identifier = int(created.body["id"])
    owner.post(identifier, Preconditions(created.headers["ETag"]), uuid4())
    return identifier


def test_return_correction_and_cancel_replay_later_rounding_and_keep_original_lines(
    engine, actor, trading
):
    fractional = fractional_trading(engine, actor, {"agency": str(trading[0])})
    product = int(fractional["product"])
    with Session(engine) as session:
        invoice = issue(session, actor, (trading[0], product), quantity=3)
        commit(session)
        owner = returns(session, actor)
        source_line = owner.core.repo.lines(owner.core.repo.document(invoice)["currentRevisionId"])[
            0
        ]["id"]
        first = post_return(owner, invoice, source_line, "0.5", "2026-01-03")
        later = post_return(owner, invoice, source_line, "0.5", "2026-01-04")
    before = snapshot(engine)
    body = SalesReturnCorrection(
        businessDate="2026-01-03",
        reason="Wrong original quantity",
        lines=[{"originLineId": str(source_line), "quantity": "0.25"}],
    )
    with Session(engine) as session:
        owner = returns(session, actor)
        use_case = ReturnCorrectionService(owner)
        token, key = match(owner, first), uuid4()
        changed = use_case.correct(first, body, token, key)
        assert changed.body["totalAmount"] == "0" and changed.body["revisionNo"] == 2
        assert use_case.correct(first, body, token, key) == changed
        late = owner.core.get(later, check_permission=False)
        assert late.currentRevision.revisionNo == 2 and late.currentRevision.totalAmount == 1
        cancelled = use_case.cancel(
            first, Reason(reason="False entry"), match(owner, first), uuid4()
        )
        assert cancelled.body["status"] == "CANCELLED"
        assert owner.core.get(later, check_permission=False).currentRevision.totalAmount == 1
    after = snapshot(engine)
    assert after["document_line"][: len(before["document_line"])] == before["document_line"]
    assert (
        after["document_revision"][: len(before["document_revision"])]
        == before["document_revision"]
    )
    for body in (
        SalesReturnCorrection(
            businessDate="2026-01-04",
            reason="Over cap",
            lines=[{"originLineId": str(source_line), "quantity": "4"}],
        ),
        SalesReturnCorrection(
            businessDate="2026-01-01",
            reason="Before sale",
            lines=[{"originLineId": str(source_line), "quantity": "0.5"}],
        ),
    ):
        with Session(engine) as session, pytest.raises(ApiError):
            owner = returns(session, actor)
            ReturnCorrectionService(owner).correct(later, body, match(owner, later), uuid4())
        assert snapshot(engine) == after
    with Session(engine) as session, pytest.raises(ApiError, match="RETURN_SOURCE_CONFLICT"):
        changes = issue_corrections(session, actor)
        changes.correct(
            invoice,
            replacement(product, sellingPriceRate="2"),
            match(changes.owner, invoice),
            uuid4(),
        )
    assert snapshot(engine) == after


def test_credit_correction_cancel_fifo_no_new_cash_and_rollback(engine, actor, trading):
    with Session(engine) as session:
        credit_cash(session, actor, trading, 100)
        issue(session, actor, trading, quantity=3, day=4)
        commit(session)
        owner = CreditApplicationService(
            session, CursorCodec(b"x" * 32), actor, "m29-credit", lambda _: None
        )
        created = owner.create(
            CreditApplicationCreate(
                agencyId=str(trading[0]), businessDate="2026-01-05", amount="60"
            ),
            uuid4(),
        )
        identifier = int(created.body["id"])
        owner.post(identifier, Preconditions(created.headers["ETag"]), uuid4())
        correction = CreditCorrectionService(owner)
        token, key = match(owner, identifier), uuid4()
        body = CreditApplicationCorrection(
            businessDate="2026-01-05", amount="40", reason="Wrong amount"
        )
        before = snapshot(engine)
        changed = correction.correct(identifier, body, token, key)
        assert changed.body["agencyBalance"]["currentCredit"] == "60"
        assert changed.body["agencyBalance"]["currentDebt"] == "266"
        assert correction.correct(identifier, body, token, key) == changed
        after = snapshot(engine)
        assert len(after["document"]) == len(before["document"])
        assert after["inventory_entry"] == before["inventory_entry"]
        assert after["document_revision"][:-1] == before["document_revision"]
        with (
            patch.object(
                correction.settlement,
                "replay",
                side_effect=RuntimeError("Injected credit replay failure"),
            ),
            pytest.raises(RuntimeError),
        ):
            correction.correct(identifier, body, match(owner, identifier), uuid4())
        assert snapshot(engine) == after
        cancelled = correction.cancel(
            identifier, Reason(reason="False offset"), match(owner, identifier), uuid4()
        )
        assert cancelled.body["agencyBalance"]["currentCredit"] == "100"
        assert cancelled.body["agencyBalance"]["currentDebt"] == "306"
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            correction.cancel(
                identifier,
                Reason(reason="Again"),
                Preconditions(cancelled.headers["ETag"]),
                uuid4(),
            )
        pending = owner.create(
            CreditApplicationCreate(
                agencyId=str(trading[0]), businessDate="2026-01-05", amount="1"
            ),
            uuid4(),
        )
        neutral = correction.cancel(
            int(pending.body["id"]),
            Reason(reason="Draft"),
            Preconditions(pending.headers["ETag"]),
            uuid4(),
        )
        assert neutral.body["agencyBalance"]["currentCredit"] == "100"
