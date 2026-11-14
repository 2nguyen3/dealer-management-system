"""OnlinePaymentService on real PostgreSQL: checkout QĐ4, IPN receipts, reconcile."""

import threading
import time
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import text

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.document_core.schemas import PaymentReceiptInput
from app.modules.document_core.service import DocumentService
from app.modules.online_payments.schemas import OnlinePaymentCreate
from app.modules.online_payments.vnpay import RESPONSE, VnpayAdapter, checksum
from tests.integration.online_payments.conftest import DEBT, counts, debt, payment_row
from tests.online_payments.harness import SECRET, config, ipn_fields
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


def body(agency, amount):
    return OnlinePaymentCreate(agencyId=str(agency), amount=Decimal(amount))


def evidence(payment, **values):
    adapter = VnpayAdapter(config())
    fields = ipn_fields(payment.merchantReference, payment.amount, **values)
    return adapter.payment_evidence(adapter.verify_callback(list(fields.items())))


def receipts(engine, agency):
    with engine.connect() as connection:
        return [
            dict(row)
            for row in connection.execute(
                text(
                    "SELECT * FROM dms.document "
                    "WHERE \"agencyId\" = :a AND kind = 'PAYMENT_RECEIPT'"
                ),
                {"a": agency},
            ).mappings()
        ]


# --------------------------------------------------------------- checkout ----


def test_checkout_for_exactly_the_current_debt_is_created(payments, world, engine):
    created = payments(world.accountant).create(body(world.agency, DEBT))
    assert created.status == "PENDING" and created.amount == DEBT
    assert created.agencyCode == f"DL-{world.agency}" and created.createdBy == str(world.accountant)
    assert created.merchantReference in created.checkoutUrl
    row = payment_row(engine, int(created.id))
    assert row["provider"] == "VNPAY" and row["receiptDocumentId"] is None
    assert row["expiresAt"] - row["createdAt"] == pytest.approx(
        timedelta(seconds=config().payment_expiry_seconds), abs=timedelta(seconds=1)
    )
    assert debt(engine, world.agency) == DEBT  # a checkout never changes the debt
    with engine.connect() as connection:
        audit = connection.execute(
            text(
                'SELECT "functionCode", "actorId" FROM dms.audit_log '
                'WHERE "entityName" = \'online_payment\' AND "entityKey" = :id'
            ),
            {"id": created.id},
        ).one()
    assert tuple(audit) == ("payments.online", world.accountant)


def test_checkout_above_the_debt_is_rejected_and_nothing_persists(payments, world, engine):
    before = counts(engine)
    with pytest.raises(ApiError) as error:
        payments(world.accountant).create(body(world.agency, DEBT + 1))
    assert (error.value.status, error.value.code) == (409, "PAYMENT_EXCEEDS_DEBT")
    assert error.value.details == {"debt": str(DEBT), "amount": str(DEBT + 1)}
    assert counts(engine) == before


def test_checkout_for_a_settled_agency_is_rejected(payments, world):
    with pytest.raises(ApiError, match="PAYMENT_EXCEEDS_DEBT"):
        payments(world.accountant).create(body(world.settled, 1))


def test_database_guard_maps_to_payment_exceeds_debt(payments, world, engine):
    service = payments(world.accountant)
    real = service.repo.agency
    service.repo.agency = lambda identifier, lock=False: {
        **real(identifier, lock=lock),
        "debt": DEBT * 10,
    }
    with pytest.raises(ApiError) as error:
        service.create(body(world.agency, DEBT + 1))
    assert (error.value.status, error.value.code) == (409, "PAYMENT_EXCEEDS_DEBT")
    assert counts(engine)["online_payment"] == 0


def test_terminated_agency_is_rejected(payments, world, engine):
    with pytest.raises(ApiError) as error:
        payments(world.accountant).create(body(world.terminated, 1000))
    assert (error.value.status, error.value.code) == (409, "AGENCY_TERMINATED")
    assert counts(engine)["online_payment"] == 0


def test_unknown_agency_is_not_found(payments, world):
    with pytest.raises(ApiError) as error:
        payments(world.accountant).create(body(999999, 1000))
    assert (error.value.status, error.value.code) == (404, "NOT_FOUND")


def test_repeated_idempotency_key_returns_the_same_payment(payments, world, engine):
    key = uuid4()
    first = payments(world.accountant).create(body(world.agency, 1000), key)
    second = payments(world.accountant).create(body(world.agency, 1000), key)
    assert first.id == second.id
    assert payment_row(engine, int(first.id))["idempotencyKey"] == key
    with pytest.raises(ApiError) as error:
        payments(world.accountant).create(body(world.agency, 2000), key)
    assert (error.value.status, error.value.code) == (409, "IDEMPOTENCY_KEY_REUSED")
    with pytest.raises(ApiError, match="IDEMPOTENCY_KEY_REUSED"):
        payments(world.manager).create(body(world.agency, 1000), key)
    assert counts(engine)["online_payment"] == 1


def test_missing_idempotency_key_creates_distinct_payments(payments, world, engine):
    first = payments(world.accountant).create(body(world.agency, 1000))
    second = payments(world.accountant).create(body(world.agency, 1000))
    assert first.id != second.id
    assert first.merchantReference != second.merchantReference


def test_concurrent_double_click_creates_one_payment(payments, world, engine):
    key = uuid4()
    services = [payments(world.accountant) for _ in range(2)]
    results, guard = [], threading.Lock()

    def run(service):
        item = service.create(body(world.agency, 1000), key)
        with guard:
            results.append(item.id)

    with engine.connect() as blocker:
        transaction = blocker.begin()
        blocker.execute(
            text("SELECT 1 FROM dms.agency WHERE id = :id FOR UPDATE"), {"id": world.agency}
        )
        threads = [threading.Thread(target=run, args=(service,)) for service in services]
        for thread in threads:
            thread.start()
        time.sleep(1.0)
        transaction.rollback()
        for thread in threads:
            thread.join(race_timeout(30))
    assert len(results) == 2 and results[0] == results[1]
    assert counts(engine)["online_payment"] == 1


# -------------------------------------------------------------------- IPN ----


def test_ipn_success_posts_one_online_receipt_and_reduces_debt(payments, world, engine):
    created = payments(world.accountant).create(body(world.agency, 400_000))
    proof = evidence(created)
    result, duplicate = payments().complete("VNPAY", proof)
    assert duplicate is False
    assert result.status == "SUCCESS" and result.providerTransactionId == "14123456"
    assert result.paymentTime == proof.paymentTime and result.checkoutUrl is None
    [receipt] = receipts(engine, world.agency)
    assert result.receiptDocumentId == str(receipt["id"])
    assert result.receiptCode == f"PT-{receipt['id']}"
    assert (receipt["status"], receipt["receiptType"]) == ("POSTED", "ONLINE")
    assert receipt["totalAmount"] == 400_000
    assert receipt["createdBy"] == world.accountant and receipt["postedBy"] is None
    assert debt(engine, world.agency) == DEBT - 400_000
    with engine.connect() as connection:
        event = connection.execute(
            text('SELECT "providerStatus", "eventKey" FROM dms.payment_event')
        ).one()
        audit = connection.execute(
            text(
                'SELECT DISTINCT "functionCode", "actorType" FROM dms.audit_log '
                'WHERE "entityName" = \'document\' AND "entityKey" = :id'
            ),
            {"id": str(receipt["id"])},
        ).all()
    assert tuple(event) == ("SUCCESS", proof.eventKey)
    assert audit == [("payments.online", "SYSTEM")]


def test_duplicate_ipn_creates_exactly_one_receipt(payments, world, engine):
    created = payments(world.accountant).create(body(world.agency, 400_000))
    proof = evidence(created)
    assert payments().complete("VNPAY", proof)[1] is False
    again, duplicate = payments().complete("VNPAY", proof)
    assert duplicate is True and again.status == "SUCCESS"
    assert len(receipts(engine, world.agency)) == 1
    assert counts(engine)["payment_event"] == 1
    assert debt(engine, world.agency) == DEBT - 400_000


def test_concurrent_duplicate_ipn_creates_exactly_one_receipt(payments, world, engine):
    created = payments(world.accountant).create(body(world.agency, 400_000))
    proof = evidence(created)
    services = [payments() for _ in range(2)]
    outcomes, guard = [], threading.Lock()

    def run(service):
        try:
            result = service.complete("VNPAY", proof)[1]
        except ApiError as error:
            result = error.code
        with guard:
            outcomes.append(result)

    with engine.connect() as blocker:
        transaction = blocker.begin()
        blocker.execute(
            text("SELECT 1 FROM dms.online_payment WHERE id = :id FOR UPDATE"),
            {"id": int(created.id)},
        )
        threads = [threading.Thread(target=run, args=(service,)) for service in services]
        for thread in threads:
            thread.start()
        time.sleep(1.0)  # both IPNs are now waiting for the payment row
        with engine.connect() as observer:
            waiting = observer.execute(
                text(
                    "SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock' "
                    "AND datname = current_database()"
                )
            ).scalar_one()
        transaction.rollback()
        for thread in threads:
            thread.join(race_timeout(30))
    assert waiting >= 2
    assert sorted(outcomes) == [False, True]
    assert len(receipts(engine, world.agency)) == 1
    assert counts(engine)["payment_event"] == 1
    assert debt(engine, world.agency) == DEBT - 400_000


def test_ipn_success_after_debt_reached_zero_makes_debt_negative(payments, world, engine):
    created = payments(world.accountant).create(body(world.agency, 500_000))
    cash = DocumentService(
        payments().session,
        CursorCodec(b"p" * 32),
        world.accountant,
        "cash",
        lambda _: None,
        kind="PAYMENT_RECEIPT",
    )
    draft = cash.create(
        PaymentReceiptInput(agencyId=str(world.agency), amount=DEBT, receiptType="CASH")
    )
    cash.post(int(draft.id), Preconditions(cash.etag(draft)))
    assert debt(engine, world.agency) == 0
    result, duplicate = payments().complete("VNPAY", evidence(created))
    assert duplicate is False and result.status == "SUCCESS"
    assert debt(engine, world.agency) == -500_000


def test_failed_ipn_records_evidence_without_receipt(payments, world, engine):
    created = payments(world.accountant).create(body(world.agency, 400_000))
    result, duplicate = payments().complete(
        "VNPAY", evidence(created, status="02", response="24", transaction="0")
    )
    assert duplicate is False and result.status == "FAILED"
    assert result.providerTransactionId is None and result.checkoutUrl is None
    assert receipts(engine, world.agency) == []
    assert debt(engine, world.agency) == DEBT
    assert counts(engine)["payment_event"] == 1


def test_gateway_expiry_marks_payment_expired(payments, world):
    created = payments(world.accountant).create(body(world.agency, 400_000))
    result, _ = payments().complete(
        "VNPAY", evidence(created, status="02", response="11", transaction="0")
    )
    assert result.status == "EXPIRED"


def test_pending_ipn_keeps_payment_pending(payments, world, engine):
    created = payments(world.accountant).create(body(world.agency, 400_000))
    result, duplicate = payments().complete(
        "VNPAY", evidence(created, status="01", transaction="0")
    )
    assert duplicate is False and result.status == "PENDING"
    assert counts(engine)["payment_event"] == 1


def test_late_success_after_failure_is_still_recorded(payments, world, engine):
    created = payments(world.accountant).create(body(world.agency, 400_000))
    payments().complete("VNPAY", evidence(created, status="02", response="24", transaction="0"))
    result, duplicate = payments().complete("VNPAY", evidence(created))
    assert duplicate is False and result.status == "SUCCESS"
    assert len(receipts(engine, world.agency)) == 1
    assert counts(engine)["payment_event"] == 2


def test_success_after_agency_termination_is_still_recorded(payments, world, engine):
    created = payments(world.accountant).create(body(world.agency, 400_000))
    with engine.begin() as connection:
        connection.execute(text("SELECT set_config('dms.function_code', 'agency.manage', true)"))
        connection.execute(
            text(
                "UPDATE dms.agency SET status = 'TERMINATED', "
                '"terminatedAt" = clock_timestamp(), '
                "\"terminationReason\" = 'Ngừng kinh doanh' WHERE id = :id"
            ),
            {"id": world.agency},
        )
    result, _ = payments().complete("VNPAY", evidence(created))
    assert result.status == "SUCCESS"
    assert debt(engine, world.agency) == DEBT - 400_000


def test_amount_mismatch_is_rejected_without_changes(payments, world, engine):
    created = payments(world.accountant).create(body(world.agency, 400_000))
    before = counts(engine)
    wrong = evidence(created).model_copy(update={"amount": Decimal(400_001)})
    with pytest.raises(ApiError) as error:
        payments().complete("VNPAY", wrong)
    assert (error.value.code, error.value.message) == (
        "PAYMENT_CONFLICT",
        "Payment evidence does not match amount",
    )
    assert counts(engine) == before and debt(engine, world.agency) == DEBT


def test_unknown_reference_is_not_found(payments, world, engine):
    ghost = SimpleNamespace(merchantReference="VNP" + "0" * 32, amount=Decimal(10200))
    with pytest.raises(ApiError) as error:
        payments().complete("VNPAY", evidence(ghost))
    assert (error.value.status, error.value.code) == (404, "NOT_FOUND")
    assert counts(engine)["payment_event"] == 0


def test_provider_transaction_cannot_be_reused_by_another_payment(payments, world, engine):
    first = payments(world.accountant).create(body(world.agency, 1000))
    second = payments(world.accountant).create(body(world.agency, 2000))
    payments().complete("VNPAY", evidence(first, transaction="777"))
    with pytest.raises(ApiError) as error:
        payments().complete("VNPAY", evidence(second, transaction="777"))
    assert (error.value.status, error.value.code) == (409, "PAYMENT_CONFLICT")
    assert payment_row(engine, int(second.id))["status"] == "PENDING"
    assert len(receipts(engine, world.agency)) == 1


def test_conflicting_success_after_success_is_rejected(payments, world, engine):
    created = payments(world.accountant).create(body(world.agency, 1000))
    payments().complete("VNPAY", evidence(created))
    with pytest.raises(ApiError, match="PAYMENT_CONFLICT"):
        payments().complete("VNPAY", evidence(created, transaction="999"))
    later = evidence(created, paid_at=datetime.now(UTC) - timedelta(minutes=5))
    with pytest.raises(ApiError, match="PAYMENT_CONFLICT"):
        payments().complete("VNPAY", later)
    assert len(receipts(engine, world.agency)) == 1


def test_failure_inside_completion_rolls_back_event_and_receipt(payments, world, engine):
    created = payments(world.accountant).create(body(world.agency, 1000))
    service = payments()
    service.repo.mark_success = Mock(side_effect=RuntimeError("crash after posting"))
    with pytest.raises(RuntimeError):
        service.complete("VNPAY", evidence(created))
    assert counts(engine)["payment_event"] == 0
    assert receipts(engine, world.agency) == []
    assert debt(engine, world.agency) == DEBT
    assert payment_row(engine, int(created.id))["status"] == "PENDING"


# -------------------------------------------------------------- reconcile ----


def query_client(payment, **values):
    """A VNPAY querydr transport answering with signed evidence for this payment."""
    fields = ipn_fields(payment.merchantReference, payment.amount, **values)
    fields.pop("vnp_SecureHash")
    data = {
        "vnp_ResponseId": "r1",
        "vnp_Command": "querydr",
        "vnp_ResponseCode": "00",
        "vnp_Message": "OK",
        "vnp_TransactionType": "01",
        **{k: v for k, v in fields.items() if k not in ("vnp_BankTranNo", "vnp_CardType")},
    }
    data["vnp_ResponseCode"] = "00"
    data["vnp_SecureHash"] = checksum(data, SECRET, RESPONSE + ["PromotionCode", "PromotionAmount"])
    return Mock(post=Mock(return_value=httpx.Response(200, json=data)))


def test_reconcile_pending_applies_the_queried_success(payments, world, engine):
    created = payments(world.accountant).create(body(world.agency, 1000))
    client = query_client(created)
    service = payments(world.manager, adapter=VnpayAdapter(config(), client=client))
    result = service.reconcile(int(created.id))
    assert result.status == "SUCCESS"
    [receipt] = receipts(engine, world.agency)
    assert receipt["postedBy"] == world.manager
    assert client.post.call_args.kwargs["json"]["vnp_TxnRef"] == created.merchantReference


@pytest.mark.parametrize("status", ["SUCCESS", "FAILED"])
def test_reconcile_terminal_payment_is_a_state_conflict(payments, world, engine, status):
    created = payments(world.accountant).create(body(world.agency, 1000))
    proof = (
        evidence(created)
        if status == "SUCCESS"
        else evidence(created, status="02", response="24", transaction="0")
    )
    payments().complete("VNPAY", proof)
    client = Mock()
    service = payments(world.manager, adapter=VnpayAdapter(config(), client=client))
    with pytest.raises(ApiError) as error:
        service.reconcile(int(created.id))
    assert (error.value.status, error.value.code) == (409, "STATE_CONFLICT")
    client.post.assert_not_called()


def test_reconcile_unknown_payment_is_not_found(payments, world):
    with pytest.raises(ApiError) as error:
        payments(world.manager).reconcile(999999)
    assert error.value.status == 404


# ------------------------------------------------------------------ reads ----


def test_list_get_and_events_project_the_persisted_state(payments, world, engine):
    first = payments(world.accountant).create(body(world.agency, 1000))
    second = payments(world.accountant).create(body(world.agency, 2000))
    payments().complete("VNPAY", evidence(first))
    reader = payments(world.manager)
    page = reader.list(limit=1)
    assert [item.id for item in page.items] == [second.id] and page.pagination.hasMore
    rest = reader.list(limit=1, cursor=page.pagination.nextCursor)
    assert [item.id for item in rest.items] == [first.id] and not rest.pagination.hasMore
    assert [item.id for item in reader.list(status="SUCCESS").items] == [first.id]
    assert [item.id for item in reader.list(agencyId=str(world.settled)).items] == []
    assert reader.get(int(second.id)).checkoutUrl is not None
    events = reader.events(int(first.id))
    [event] = events.items
    assert event.providerStatus == "SUCCESS"
    assert event.verifiedData.amount == 1000
    assert event.verifiedData.merchantReference == first.merchantReference
    assert reader.events(int(second.id)).items == []
    with pytest.raises(ApiError, match="NOT_FOUND"):
        reader.events(999999)
