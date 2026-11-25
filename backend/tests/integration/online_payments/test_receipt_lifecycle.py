"""Per-agency receipt lifecycle across counter receipts and VNPAY checkouts."""

import pytest

from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.document_core.schemas import PaymentReceiptInput
from app.modules.document_core.service import DocumentService
from tests.integration.online_payments.conftest import CODEC, DEBT, counts, debt, lapse
from tests.integration.online_payments.test_payments import body, evidence

pytestmark = pytest.mark.integration


@pytest.fixture
def counter(payments, world):
    return DocumentService(
        payments().session,
        CODEC,
        world.accountant,
        "counter",
        lambda _: None,
        kind="PAYMENT_RECEIPT",
    )


def receipt(agency, amount):
    return PaymentReceiptInput(agencyId=str(agency), amount=str(amount), receiptType="CASH")


def test_only_one_open_payment_then_collect_the_new_balance(counter, payments, world, engine):
    online = payments(world.accountant)
    with pytest.raises(ApiError, match="PAYMENT_EXCEEDS_DEBT"):
        counter.create(receipt(world.agency, DEBT + 1))
    draft = counter.create(receipt(world.agency, 500_000))
    with pytest.raises(ApiError, match="PAYMENT_IN_PROGRESS"):
        counter.create(receipt(world.agency, 1))
    with pytest.raises(ApiError, match="PAYMENT_IN_PROGRESS"):
        online.create(body(world.agency, 1))
    assert counts(engine) == {"document": 1, "online_payment": 0, "payment_event": 0}
    counter.post(int(draft.id), Preconditions(counter.etag(draft)))
    with pytest.raises(ApiError, match="PAYMENT_EXCEEDS_DEBT"):
        online.create(body(world.agency, 1_000_001))
    checkout = online.create(body(world.agency, 1_000_000))
    with pytest.raises(ApiError, match="PAYMENT_IN_PROGRESS"):
        counter.create(receipt(world.agency, 1))
    online.complete("VNPAY", evidence(checkout))
    assert debt(engine, world.agency) == 0


def test_a_lapsed_checkout_no_longer_blocks_a_counter_receipt(counter, payments, world, engine):
    checkout = payments(world.accountant).create(body(world.agency, 1_000_000))
    with pytest.raises(ApiError, match="PAYMENT_IN_PROGRESS"):
        counter.create(receipt(world.agency, 1))
    lapse(engine, checkout.id)
    draft = counter.create(receipt(world.agency, DEBT))
    assert draft.status == "DRAFT"
    assert counts(engine) == {"document": 1, "online_payment": 1, "payment_event": 0}
