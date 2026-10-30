from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from app.modules.document_corrections.returns import ReturnCorrectionService
from app.modules.sales_returns.schemas import SalesReturnCorrection
from app.modules.stock_issues.schemas import PendingIssueRevision
from app.modules.stock_receipts.schemas import Reason
from app.modules.upfront_payments.service import UpfrontPaymentService
from tests.integration.document_corrections.helpers import snapshot
from tests.integration.document_corrections.test_issues import (
    ready_with_money,
    replacement,
    token,
    use_case,
)
from tests.integration.document_corrections.test_return_credit import match, post_return, returns
from tests.integration.settlement_core.helpers import commit, issue

pytestmark = pytest.mark.integration


def test_return_failure_after_each_mutation_stage_rolls_back_every_effect(engine, actor, trading):
    with Session(engine) as session:
        invoice = issue(session, actor, trading, quantity=3)
        commit(session)
        owner = returns(session, actor)
        line = owner.core.repo.lines(owner.core.repo.document(invoice)["currentRevisionId"])[0]
        identifier = post_return(owner, invoice, line["id"], "1", "2026-01-03")
        condition = match(owner, identifier)
    before = snapshot(engine)
    body = SalesReturnCorrection(
        businessDate="2026-01-04",
        reason="Wrong return quantity",
        lines=[{"originLineId": str(line["id"]), "quantity": "2"}],
    )
    for stage in ("revision", "reverse", "rounding", "replay", "projection"):
        with Session(engine) as session:
            owner = returns(session, actor)
            correction = ReturnCorrectionService(owner)
            target, name = {
                "revision": (owner.core, "new_revision"),
                "reverse": (correction, "reverse"),
                "rounding": (correction, "replay_rounding"),
                "replay": (correction.settlement, "replay"),
                "projection": (owner, "result"),
            }[stage]
            original = getattr(target, name)

            def fail_after(*args, _original=original, **kwargs):
                _original(*args, **kwargs)
                raise RuntimeError("Injected return stage failure")

            with patch.object(target, name, side_effect=fail_after), pytest.raises(RuntimeError):
                correction.correct(identifier, body, condition, uuid4())
        assert snapshot(engine) == before


@pytest.mark.parametrize("stage", ["auto-successor", "separation"])
def test_upfront_failure_after_linked_money_mutation_rolls_back(engine, actor, trading, stage):
    identifier = ready_with_money(engine, actor, trading, posted=True)
    condition = token(engine, actor, identifier)
    before = snapshot(engine)
    with Session(engine) as session:
        correction = use_case(session, actor)
        name = "sync_auto" if stage == "auto-successor" else "separate_money"
        original = getattr(correction, name)

        def fail_after(*args, **kwargs):
            original(*args, **kwargs)
            raise RuntimeError("Injected linked money stage failure")

        with patch.object(correction, name, side_effect=fail_after), pytest.raises(RuntimeError):
            if stage == "auto-successor":
                correction.correct(
                    identifier,
                    replacement(trading[1], businessDate="2026-01-03"),
                    condition,
                    uuid4(),
                )
            else:
                correction.cancel(identifier, Reason(reason="No delivery"), condition, uuid4())
    assert snapshot(engine) == before


def test_posted_issue_with_separated_historical_confirmation_does_not_sync_it(
    engine, actor, trading
):
    identifier = ready_with_money(engine, actor, trading, posted=False)
    with Session(engine) as session:
        correction = use_case(session, actor)
        evidence = correction.evidence(identifier)[0]
        upfront = UpfrontPaymentService(
            session,
            correction.owner.codec,
            actor,
            "m29-separated-history",
            lambda _: None,
        )
        item = upfront.get(evidence["id"])
        upfront.separate(
            evidence["id"],
            Reason(reason="Already received"),
            Preconditions(upfront.etag(item)),
            uuid4(),
        )
        revision = correction.owner.replace_pending(
            identifier,
            PendingIssueRevision(
                businessDate="2026-01-02",
                reason="Money received separately",
                immediatePayment="0",
                lines=[{"productId": str(trading[1]), "quantity": "3"}],
            ),
            token(engine, actor, identifier),
            uuid4(),
        )
        submitted = correction.owner.submit(
            identifier, Preconditions(revision.headers["ETag"]), uuid4()
        )
        correction.owner.post(identifier, Preconditions(submitted.headers["ETag"]), uuid4())
        with patch.object(correction, "sync_auto") as synchronize:
            result = correction.correct(
                identifier,
                replacement(trading[1], businessDate="2026-01-03"),
                token(engine, actor, identifier),
                uuid4(),
            )
        synchronize.assert_not_called()
        assert result.body["immediatePayment"] == "0"
