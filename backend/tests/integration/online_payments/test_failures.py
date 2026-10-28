from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError
from app.modules.online_payments.schemas import Checkout, OnlinePaymentCreate, VerifiedPayment
from app.modules.settlement_core.service import SettlementService
from tests.integration.online_payments.test_recovery import use
from tests.integration.settlement_core.helpers import commit, issue

pytestmark = pytest.mark.integration


def test_completion_partial_rollback_and_unknown_commit_recovery(engine, actor, trading):
    agency, product = int(trading["agency"]), int(trading["product"])
    adapter = Mock()
    adapter.create_checkout.return_value = Checkout(
        checkoutUrl="https://controlled.test/a", expiresAt="2026-12-01T00:00:00Z"
    )
    with Session(engine) as session:
        issue(session, actor, (agency, product), day=4)
        commit(session)
        online = use(session, actor, adapter)
        body = OnlinePaymentCreate(agencyId=str(agency), provider="CONTROLLED", amount="102")
        created = online.create(body, uuid4())
        second = online.create(body, uuid4())
        evidence = VerifiedPayment(
            eventKey="success",
            merchantReference=created.body["merchantReference"],
            providerTransactionId="txn-1",
            amount="102",
            status="SUCCESS",
            paymentTime="2026-01-05T00:00:00Z",
        )
        with patch.object(
            SettlementService, "post_receipt", side_effect=RuntimeError("mid-completion")
        ):
            with pytest.raises(RuntimeError, match="mid-completion"):
                online.complete("CONTROLLED", evidence)
        with engine.connect() as check:
            assert check.scalar(text("SELECT count(*) FROM dms.payment_event")) == 0
            assert (
                check.scalar(text("SELECT count(*) FROM dms.document WHERE kind='PAYMENT_RECEIPT'"))
                == 0
            )
            assert check.scalar(text("SELECT status FROM dms.online_payment")) == "PENDING"
        original = session.commit

        def lost_commit_reply():
            original()
            raise DBAPIError(
                None, None, Exception("lost-commit-reply"), connection_invalidated=True
            )

        with patch.object(session, "commit", side_effect=lost_commit_reply):
            with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
                online.complete("CONTROLLED", evidence)
        recovered, duplicate = online.complete("CONTROLLED", evidence)
        assert recovered.status == "SUCCESS" and duplicate
        reconcile_key = uuid4()
        commits = []

        def lost_final_result_reply():
            original()
            commits.append(True)
            if len(commits) == 2:
                raise DBAPIError(
                    None, None, Exception("lost-result-reply"), connection_invalidated=True
                )

        with patch.object(session, "commit", side_effect=lost_final_result_reply):
            with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
                online.reconcile(int(created.body["id"]), reconcile_key)
        assert (
            online.reconcile(int(created.body["id"]), reconcile_key).receiptDocumentId
            == recovered.receiptDocumentId
        )
        with pytest.raises(ApiError, match="PAYMENT_CONFLICT"):
            online.complete(
                "CONTROLLED",
                evidence.model_copy(
                    update={
                        "merchantReference": second.body["merchantReference"],
                        "eventKey": "other-payment",
                    }
                ),
            )
        with pytest.raises(ApiError, match="NOT_FOUND"):
            online.complete("OTHER", evidence)
        with pytest.raises(ApiError, match="UNSUPPORTED_PROVIDER"):
            online.create(body.model_copy(update={"provider": "OTHER"}), uuid4())
