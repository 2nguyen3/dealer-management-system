from dataclasses import replace
from datetime import date
from decimal import Decimal

import pytest

from app.core.exceptions import ApiError
from app.modules.settlement_core.allocation import money, pair_credit_provenance, plan_fifo
from app.modules.settlement_core.models import Allocation, CashPair, CashSlice, Invoice

D = Decimal
DAY = date(2026, 1, 1)


@pytest.mark.parametrize(
    "value",
    [True, 1, 1.0, "1", D("NaN"), D("Infinity"), D("-1"), D("0.1"), D("1000000000000000000"), D(0)],
)
def test_money_rejects_inexact_invalid_and_overflow(value):
    with pytest.raises(ValueError):
        money(value)


def test_money_maximum_and_zero_boundary():
    assert money(D("999999999999999999")) == D("999999999999999999")
    assert money(D(0), positive=False) == 0


def test_fifo_uses_historical_checkpoint_original_order_and_exact_amounts():
    invoices = (
        Invoice(3, 1, DAY, 3, D(80)),
        Invoice(2, 1, DAY, 2, D(70)),
        Invoice(1, 1, DAY, 1, D(30)),
        Invoice(4, 1, date(2026, 2, 1), 1, D(90)),
    )
    assert plan_fifo(1, D(60), invoices, (DAY, 2)) == (
        (Allocation(1, D(30)), Allocation(2, D(30))),
        D(0),
    )
    assert plan_fifo(1, D(100), invoices, (DAY, 2))[1] == 0
    assert plan_fifo(1, D(101), invoices, (DAY, 2), allow_excess=True)[1] == 1
    with pytest.raises(ApiError, match="PAYMENT_EXCEEDS_DEBT"):
        plan_fifo(1, D(101), invoices, (DAY, 2))
    assert plan_fifo(1, D(50), invoices, (DAY, 3), target_id=3)[0] == (Allocation(3, D(50)),)
    for invalid in (
        (invoices[0], invoices[0]),
        (replace(invoices[0], agency_id=2),),
        (replace(invoices[0], due=D(-1)),),
    ):
        with pytest.raises(ValueError):
            plan_fifo(1, D(1), invalid, (DAY, 3))
    assert plan_fifo(1, D(1), (replace(invoices[0], due=D(0)),), (DAY, 3), allow_excess=True) == (
        (),
        D(1),
    )


def test_pairing_spans_both_axes_and_conserves_cash():
    sources = (CashSlice(10, D(60)), CashSlice(11, D(40)))
    allocations = (Allocation(1, D(30)), Allocation(2, D(50)), Allocation(3, D(20)))
    assert pair_credit_provenance(sources, allocations) == (
        CashPair(10, 1, D(30)),
        CashPair(10, 2, D(30)),
        CashPair(11, 2, D(20)),
        CashPair(11, 3, D(20)),
    )
    assert pair_credit_provenance((), ()) == ()
    with pytest.raises(ValueError, match="conserve"):
        pair_credit_provenance(sources, allocations[:-1])
    with pytest.raises(ValueError):
        pair_credit_provenance((CashSlice(10, D(0)),), ())
