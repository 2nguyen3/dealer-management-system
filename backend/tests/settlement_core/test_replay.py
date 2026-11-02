from dataclasses import replace
from datetime import date
from decimal import Decimal

import pytest

from app.core.exceptions import ApiError
from app.modules.settlement_core.models import Event, Leg, Lot, LotKey
from app.modules.settlement_core.replay import CAPABILITIES, plan_replay, validate_event
from app.modules.settlement_core.service import normalized_legs

D = Decimal
DAY = date(2026, 1, 1)


def event(identifier, kind, amount, *, day=1, order=None, origin=None, receipt=None, method=None):
    return Event(
        identifier,
        identifier,
        1,
        kind,
        date(2026, 1, day),
        order or identifier,
        D(amount),
        origin,
        receipt,
        method,
    )


def test_backdated_charge_reallocates_later_receipt_without_changing_source_cash():
    later = event(2, "STOCK_ISSUE", 100, day=3)
    earlier = event(3, "STOCK_ISSUE", 70, day=2)
    receipt = event(4, "PAYMENT_RECEIPT", 100, day=4, receipt="DEBT_COLLECTION", method="CASH")
    plan = plan_replay(1, (later, receipt, earlier))
    assert plan.debt == 70 and plan.credit == 0
    assert plan.sources[-1] == (
        receipt,
        (Leg("receivable", "PAYMENT", 3, D(-70)), Leg("receivable", "PAYMENT", 2, D(-30))),
    )
    with pytest.raises(ApiError, match="PAYMENT_EXCEEDS_DEBT"):
        plan_replay(1, (replace(receipt, business_date=DAY), later))


def test_atomic_auto_receipt_targets_only_origin_and_has_no_surplus():
    issue = event(4, "STOCK_ISSUE", 100, order=4)
    auto = event(
        1, "PAYMENT_RECEIPT", 40, order=4, origin=4, receipt="AUTO_FROM_ISSUE", method="CASH"
    )
    older = event(2, "STOCK_ISSUE", 90, order=2)
    plan = plan_replay(1, (auto, issue, older))
    assert plan.sources[-1][1] == (Leg("receivable", "PAYMENT", 4, D(-40)),)
    assert plan.debt == 150
    with pytest.raises(ApiError):
        plan_replay(1, (replace(auto, amount=D(101), payment_method="ONLINE"), issue, older))
    for wrong in (replace(auto, business_date=date(2026, 1, 2)), replace(auto, origin_id=999)):
        with pytest.raises(ApiError, match="PAYMENT_SOURCE_CONFLICT"):
            plan_replay(1, (wrong, issue, older))


def test_multi_receipt_credit_application_return_reapplication_preserves_original_cash():
    first = event(1, "PAYMENT_RECEIPT", 60, receipt="RECEIVED_UNAPPLIED", method="CASH")
    second = event(2, "PAYMENT_RECEIPT", 40, receipt="DEBT_COLLECTION", method="ONLINE")
    issue = event(3, "STOCK_ISSUE", 100, day=2)
    application = event(4, "CREDIT_APPLICATION", 100, day=3)
    returned = event(5, "SALES_RETURN", 70, day=4, origin=3)
    another = event(6, "STOCK_ISSUE", 70, day=5)
    reapply = event(7, "CREDIT_APPLICATION", 70, day=6)
    returned_again = event(8, "SALES_RETURN", 70, day=7, origin=6)
    plan = plan_replay(
        1, (first, second, issue, application, returned, another, reapply, returned_again)
    )
    assert plan.debt == 0 and plan.credit == 70
    final = normalized_legs(plan.sources[-1][1])
    assert final == {
        ("credit", "CREATED", LotKey(8, 1)): D(60),
        ("credit", "CREATED", LotKey(8, 2)): D(10),
    }
    assert sum(final.values()) == 70


def test_existing_lot_identity_duplicate_origin_capacity_and_paid_refund_are_preserved():
    cash = event(1, "PAYMENT_RECEIPT", 100, receipt="RECEIVED_UNAPPLIED", method="CASH")
    lots = (Lot(LotKey(1, 1, 20), DAY, 1, D(60)), Lot(LotKey(1, 1, 21), DAY, 1, D(20)))
    refund = replace(event(2, "REFUND", 30, day=2, origin=1), refund_debits=((lots[0].key, D(30)),))
    plan = plan_replay(1, (cash, refund), lots)
    assert plan.credit == 70
    assert normalized_legs(plan.sources[0][1]) == {
        ("credit", "CREATED", lots[0].key): D(60),
        ("credit", "CREATED", lots[1].key): D(40),
    }
    for bad in (
        replace(refund, refund_debits=()),
        replace(refund, origin_id=99),
        replace(refund, refund_debits=((lots[0].key, D(101)),), amount=D(101)),
    ):
        with pytest.raises(ApiError, match="REFUND_SOURCE_CONFLICT"):
            plan_replay(1, (cash, bad), lots)


def test_zero_created_existing_lot_and_repeated_paid_origin_slices_remain_conserved():
    cash = event(1, "PAYMENT_RECEIPT", 100, receipt="RECEIVED_UNAPPLIED", method="CASH")
    empty = Lot(LotKey(1, 1, 10), DAY, 1, D(0))
    assert plan_replay(1, (cash,), (empty,)).credit == 100
    issue = event(2, "STOCK_ISSUE", 100, day=2)
    paid = event(3, "CREDIT_APPLICATION", 100, day=3)
    returned = event(4, "SALES_RETURN", 100, day=4, origin=2)
    split_lots = (Lot(LotKey(1, 1, 10), DAY, 1, D(60)), Lot(LotKey(1, 1, 11), DAY, 1, D(40)))
    plan = plan_replay(1, (cash, issue, paid, returned), split_lots)
    assert normalized_legs(plan.sources[-1][1]) == {("credit", "CREATED", LotKey(4, 1)): D(100)}


def test_return_debt_first_zero_boundary_and_reserved_credit_exclusion():
    issue = event(1, "STOCK_ISSUE", 100)
    receipt = event(2, "PAYMENT_RECEIPT", 40, day=2, receipt="DEBT_COLLECTION", method="CASH")
    returned = event(3, "SALES_RETURN", 70, day=3, origin=1)
    lot = Lot(LotKey(3, 2, 50), date(2026, 1, 3), 3, D(10), D(10))
    plan = plan_replay(1, (issue, receipt, returned), (lot,))
    assert plan.debt == 0 and plan.credit == 10
    assert plan.sources[-1][1] == (
        Leg("receivable", "RETURN", 1, D(-60)),
        Leg("credit", "CREATED", lot.key, D(10)),
    )
    assert plan_replay(1, (issue, replace(returned, amount=D(0)))).debt == 100
    assert plan_replay(1, (issue, replace(returned, amount=D(60)))).debt == 40
    with pytest.raises(ApiError, match="CREDIT_RESERVED"):
        plan_replay(1, (issue, receipt, replace(returned, amount=D(60))), (lot,))
    with pytest.raises(ApiError, match="RETURN_SOURCE_CONFLICT"):
        plan_replay(1, (returned,))
    with pytest.raises(ApiError, match="RETURN_SOURCE_CONFLICT"):
        plan_replay(1, (issue, receipt, replace(returned, amount=D(101))))
    next_issue = event(4, "STOCK_ISSUE", 10, day=4)
    apply = event(5, "CREDIT_APPLICATION", 10, day=5)
    with pytest.raises(ApiError, match="INSUFFICIENT_CREDIT"):
        plan_replay(1, (issue, receipt, returned, next_issue, apply), (lot,))


def test_invalid_event_and_duplicate_inputs_are_rejected_and_neutral_kinds_registered():
    valid = event(1, "PAYMENT_RECEIPT", 1, receipt="DEBT_COLLECTION", method="CASH")
    for invalid in (
        replace(valid, agency_id=2),
        replace(valid, document_id=0),
        replace(valid, document_id=True),
        replace(valid, business_date="2026-01-01"),
        replace(valid, kind="UNKNOWN"),
        replace(valid, receipt_type="OTHER"),
        replace(valid, payment_method="OTHER"),
        replace(valid, receipt_type="AUTO_FROM_ISSUE", origin_id=None),
        replace(valid, receipt_type="AUTO_FROM_ISSUE", origin_id=0),
    ):
        with pytest.raises(ValueError):
            validate_event(invalid, 1)
    with pytest.raises(ValueError, match="Duplicate financial"):
        plan_replay(1, (valid, valid))
    lot = Lot(LotKey(1, 1, 1), DAY, 1, D(0))
    with pytest.raises(ValueError, match="Duplicate credit"):
        plan_replay(1, (), (lot, lot))
    assert len(CAPABILITIES) == 7
    assert (
        plan_replay(1, (event(1, "STOCK_ADJUSTMENT", 0), event(2, "STOCK_RECEIPT", 100))).sources[
            0
        ][1]
        == ()
    )
    assert plan_replay(1, ()).debt == 0
