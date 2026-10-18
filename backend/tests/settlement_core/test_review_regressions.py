from dataclasses import replace
from datetime import date
from decimal import Decimal

import pytest

from app.core.exceptions import ApiError
from app.modules.settlement_core.models import Lot, LotKey
from app.modules.settlement_core.replay import plan_replay
from app.modules.settlement_core.service import normalized_legs
from tests.settlement_core.test_replay import DAY, event

D = Decimal


@pytest.mark.parametrize("balance", ["debt", "credit"])
def test_current_balance_storage_boundary_returns_a_business_conflict(balance):
    kind = "STOCK_ISSUE" if balance == "debt" else "PAYMENT_RECEIPT"
    options = {} if balance == "debt" else {"receipt": "RECEIVED_UNAPPLIED", "method": "CASH"}
    first = event(1, kind, 600000000000000000, day=1, **options)
    second = event(2, kind, 399999999999999999, day=2, **options)
    at_limit = plan_replay(1, (first, second))
    assert getattr(at_limit, balance) == D("999999999999999999")
    with pytest.raises(ApiError, match="BALANCE_OVERFLOW") as failure:
        plan_replay(1, (first, replace(second, amount=D("400000000000000000"))))
    assert failure.value.status == 409


def test_new_lot_fifo_matches_eventual_database_insertion_order():
    # IDs are intentionally the reverse of business-date order.
    early_cash = event(
        20, "PAYMENT_RECEIPT", 60, day=1, receipt="RECEIVED_UNAPPLIED", method="CASH"
    )
    later_cash = event(
        10, "PAYMENT_RECEIPT", 40, day=2, receipt="RECEIVED_UNAPPLIED", method="CASH"
    )
    issue = event(30, "STOCK_ISSUE", 100, day=3)
    apply = event(40, "CREDIT_APPLICATION", 100, day=4)
    returned = event(50, "SALES_RETURN", 100, day=5, origin=30)
    next_issue = event(60, "STOCK_ISSUE", 60, day=6)
    next_apply = event(70, "CREDIT_APPLICATION", 60, day=7)
    events = (early_cash, later_cash, issue, apply, returned, next_issue, next_apply)
    first = plan_replay(1, events)
    emitted = []
    for source, legs in first.sources:
        for leg in legs:
            if leg.kind == "CREATED":
                emitted.append(
                    Lot(
                        replace(leg.target, id=100 + len(emitted)),
                        source.business_date,
                        source.business_order,
                        leg.amount,
                    )
                )
    second = plan_replay(1, events, tuple(emitted))
    assert [
        (leg.target.receipt_id, leg.amount)
        for leg in first.sources[-1][1]
        if leg.ledger == "credit"
    ] == [(20, D(-60))]
    assert [
        (leg.target.receipt_id, leg.amount)
        for leg in second.sources[-1][1]
        if leg.ledger == "credit"
    ] == [(20, D(-60))]
    assert first.debt == second.debt and first.credit == second.credit


@pytest.mark.parametrize("protection", ["reserved", "paid"])
def test_duplicate_origin_lots_preserve_protected_minimum_before_redistributing(protection):
    issue = event(2, "STOCK_ISSUE", 40, day=1)
    cash = event(1, "PAYMENT_RECEIPT", 100, day=2, receipt="RECEIVED_UNAPPLIED", method="CASH")
    first = Lot(LotKey(1, 1, 10), date(2026, 1, 2), 1, D(60))
    second = Lot(
        LotKey(1, 1, 11), date(2026, 1, 2), 1, D(40), D(40) if protection == "reserved" else D(0)
    )
    events = (issue, cash)
    if protection == "paid":
        refund = replace(
            event(3, "REFUND", 40, day=3, origin=1), refund_debits=((second.key, D(40)),)
        )
        events += (refund,)
    plan = plan_replay(1, events, (first, second))
    assert normalized_legs(plan.sources[1][1]) == {
        ("receivable", "PAYMENT", 2): D(-40),
        ("credit", "CREATED", first.key): D(20),
        ("credit", "CREATED", second.key): D(40),
    }
    assert plan.credit == (60 if protection == "reserved" else 20)
    exact = plan_replay(1, (replace(issue, amount=D(60)), *events[1:]), (first, second))
    assert ("credit", "CREATED", first.key) not in normalized_legs(exact.sources[1][1])
    assert exact.credit == (40 if protection == "reserved" else 0)


def test_later_paid_refund_protection_does_not_get_spent_by_an_earlier_application():
    cash = event(1, "PAYMENT_RECEIPT", 100, receipt="RECEIVED_UNAPPLIED", method="CASH")
    lot = Lot(LotKey(1, 1, 10), DAY, 1, D(100))
    invoice = event(2, "STOCK_ISSUE", 60, day=2)
    apply = event(3, "CREDIT_APPLICATION", 60, day=3)
    paid = replace(event(4, "REFUND", 40, day=4, origin=1), refund_debits=((lot.key, D(40)),))
    plan = plan_replay(1, (cash, invoice, apply, paid), (lot,))
    assert plan.debt == 0 and plan.credit == 0


@pytest.mark.parametrize("paid", [False, True])
def test_return_selects_protected_receipt_origins_before_unprotected_preferences(paid):
    first = event(1, "PAYMENT_RECEIPT", 80, receipt="RECEIVED_UNAPPLIED", method="CASH")
    second = event(2, "PAYMENT_RECEIPT", 80, receipt="RECEIVED_UNAPPLIED", method="CASH")
    invoices = (
        event(3, "STOCK_ISSUE", 60, day=2),
        event(4, "STOCK_ISSUE", 100, day=2),
        event(5, "STOCK_ISSUE", 100, day=2),
    )
    apply = event(6, "CREDIT_APPLICATION", 160, day=4)
    returned = event(7, "SALES_RETURN", 60, day=5, origin=4)
    lots = (
        Lot(LotKey(1, 1, 10), DAY, 1, D(80)),
        Lot(LotKey(2, 2, 11), DAY, 2, D(80)),
        Lot(LotKey(7, 1, 12), date(2026, 1, 5), 7, D(20)),
        Lot(LotKey(7, 2, 13), date(2026, 1, 5), 7, D(40), D(0) if paid else D(40)),
    )
    events = (first, second, *invoices, apply, returned)
    if paid:
        events += (
            replace(
                event(8, "REFUND", 40, day=6, origin=2), refund_debits=((lots[-1].key, D(40)),)
            ),
        )
    baseline = plan_replay(1, events, lots)
    backdated = event(9, "PAYMENT_RECEIPT", 40, day=3, receipt="DEBT_COLLECTION", method="CASH")
    updated = plan_replay(1, (*events, backdated), lots)
    desired = {
        ("credit", "CREATED", lots[-2].key): D(20),
        ("credit", "CREATED", lots[-1].key): D(40),
    }
    assert normalized_legs(dict(baseline.sources)[returned]) == desired
    assert normalized_legs(dict(updated.sources)[returned]) == desired
    assert updated.debt == baseline.debt - 40


@pytest.mark.parametrize("paid", [False, True])
def test_earlier_return_keeps_paid_cash_needed_for_later_protected_return(paid):
    invoice = event(1, "STOCK_ISSUE", 100)
    first = event(2, "PAYMENT_RECEIPT", 20, day=2, receipt="DEBT_COLLECTION", method="CASH")
    second = event(3, "PAYMENT_RECEIPT", 80, day=4, receipt="DEBT_COLLECTION", method="ONLINE")
    return_one = event(4, "SALES_RETURN", 60, day=5, origin=1)
    return_two = event(5, "SALES_RETURN", 40, day=6, origin=1)
    lots = (
        Lot(LotKey(4, 2, 10), date(2026, 1, 5), 4, D(20)),
        Lot(LotKey(4, 3, 11), date(2026, 1, 5), 4, D(40)),
        Lot(LotKey(5, 3, 12), date(2026, 1, 6), 5, D(40), D(0) if paid else D(40)),
    )
    events = (invoice, first, second, return_one, return_two)
    if paid:
        events += (
            replace(
                event(6, "REFUND", 40, day=7, origin=3), refund_debits=((lots[-1].key, D(40)),)
            ),
        )
    plan_replay(1, events, lots)
    inserted = event(7, "PAYMENT_RECEIPT", 40, day=3, receipt="DEBT_COLLECTION", method="CASH")
    updated = plan_replay(1, (*events, inserted), lots)
    assert normalized_legs(dict(updated.sources)[return_one]) == {
        ("credit", "CREATED", lots[0].key): D(20),
        ("credit", "CREATED", LotKey(4, 7)): D(40),
    }
    assert normalized_legs(dict(updated.sources)[return_two]) == {
        ("credit", "CREATED", lots[-1].key): D(40)
    }
