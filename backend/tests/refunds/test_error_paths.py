from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy.exc import DBAPIError

from app.common.commands import CommandRepository
from app.core.exceptions import ApiError
from app.modules.refunds.online import OnlineRefundService
from app.modules.refunds.reads import RefundEvidenceReads
from app.modules.refunds.router import refund_responses
from app.modules.refunds.schemas import VerifiedRefund


def test_source_receipt_kind_and_post_wait_state_recheck():
    service = OnlineRefundService(Mock(), Mock(), 1, "guard", lambda _: None, None)
    service.settlement = Mock()
    service.lock_agency = Mock(return_value={"id": 1})
    service.settlement.repo.source.return_value = {"kind": "STOCK_ISSUE", "status": "POSTED"}
    with pytest.raises(ApiError, match="REFUND_SOURCE_CONFLICT"):
        service.source_receipt(1, "cash.refund.prepare", "CASH")
    service.settlement.repo.source.side_effect = [
        {"kind": "PAYMENT_RECEIPT", "status": "POSTED", "agencyId": 1},
        {"kind": "PAYMENT_RECEIPT", "status": "CANCELLED", "agencyId": 1},
    ]
    with pytest.raises(ApiError, match="REFUND_SOURCE_CONFLICT"):
        service.source_receipt(1, "cash.refund.prepare", "CASH")


def test_refund_evidence_sort_and_database_outcome_errors():
    service = OnlineRefundService(Mock(), Mock(), 1, "errors", lambda _: None, None)
    service.source = Mock()
    with pytest.raises(ApiError, match="VALIDATION_FAILED"):
        RefundEvidenceReads(service).page(1, resource="attempts", sort="invalid")
    failure = DBAPIError(None, None, Exception("secret-sentinel"), connection_invalidated=True)
    service.session.scalar.side_effect = failure
    with pytest.raises(ApiError) as caught:
        service.reconcile(1, uuid4())
    assert caught.value.status == 503 and "secret-sentinel" not in str(caught.value)
    service.session.scalar.side_effect = RuntimeError("definite-failure")
    with pytest.raises(RuntimeError, match="definite-failure"):
        service.reconcile(1, uuid4())
    service.attempt = Mock(side_effect=failure)
    with pytest.raises(ApiError) as caught:
        service.complete_attempt(1, Mock())
    assert caught.value.status == 503
    from types import SimpleNamespace

    unique = DBAPIError(None, None, SimpleNamespace(sqlstate="23505"))
    service.attempt.side_effect = unique
    with pytest.raises(ApiError) as caught:
        service.complete_attempt(1, Mock())
    assert caught.value.status == 409
    service.attempt.side_effect = failure
    with pytest.raises(DBAPIError):
        service.mark_unknown(1)
    assert "Retry-After" not in refund_responses(200)[200]["headers"]


def test_payout_intent_definite_and_ambiguous_database_failures_are_distinct():
    session = Mock()
    service = OnlineRefundService(session, Mock(), 1, "intent-errors", lambda _: None, Mock())
    failure = DBAPIError(None, None, Exception("secret-sentinel"), connection_invalidated=True)
    with patch.object(CommandRepository, "claim", side_effect=failure):
        with pytest.raises(ApiError) as caught:
            service.request(1, None, uuid4())
        assert caught.value.status == 503
    command = SimpleNamespace(result={"body": {"id": "1"}})
    with patch.object(CommandRepository, "claim", return_value=(command, False)):
        session.commit.side_effect = failure
        with pytest.raises(ApiError, match="COMMAND_OUTCOME_UNKNOWN"):
            service.request(1, None, uuid4())
        session.commit.side_effect = DBAPIError(None, None, SimpleNamespace(sqlstate="23514"))
        with pytest.raises(ApiError) as caught:
            service.request(1, None, uuid4())
        assert caught.value.status == 503


def test_verified_payout_without_initiating_actor_never_invents_a_poster():
    session = Mock()
    service = OnlineRefundService(session, Mock(), 2, "missing-actor", lambda _: None, Mock())
    service.attempt = Mock(
        return_value={
            "refundDocumentId": 1,
            "merchantRefundReference": "r",
            "amount": Decimal(1),
            "state": "UNKNOWN",
        }
    )
    service.source = Mock(return_value={"agencyId": 1})
    service.lock_agency = Mock(return_value={"id": 1})
    service.settlement.repo.lock_history = Mock()
    session.scalar.return_value = None
    proof = VerifiedRefund(
        merchantRefundReference="r",
        amount="1",
        state="SUCCESS",
        providerRefundId="p",
        completedAt="2026-01-01T00:00:00Z",
    )
    with pytest.raises(ApiError, match="STATE_CONFLICT"):
        service.complete_attempt(1, proof)
    session.rollback.assert_called_once()
    assert not session.execute.called


def test_business_payout_conflict_is_not_suppressed_as_transport_unknown():
    session = Mock()
    adapter = Mock()
    service = OnlineRefundService(session, Mock(), 1, "business-conflict", lambda _: None, adapter)
    service.attempt = Mock(
        return_value={
            "state": "PENDING",
            "onlinePaymentId": 1,
            "merchantRefundReference": "r",
            "amount": Decimal(1),
        }
    )
    session.execute.return_value.mappings.return_value.one.return_value = {
        "merchantReference": "p",
        "provider": "CONTROLLED",
    }
    service.complete_attempt = Mock(
        side_effect=ApiError(409, "REFUND_CONFLICT", "conflicting payout")
    )
    service.mark_unknown = Mock()
    with pytest.raises(ApiError, match="REFUND_CONFLICT"):
        service.dispatch(1)
    service.mark_unknown.assert_not_called()
