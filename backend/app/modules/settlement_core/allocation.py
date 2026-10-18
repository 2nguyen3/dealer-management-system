from decimal import Decimal

from app.common.values import validate_number
from app.core.exceptions import ApiError
from app.modules.settlement_core.models import Allocation, CashPair, CashSlice, Invoice


def money(value: Decimal, *, positive: bool = True) -> Decimal:
    if not isinstance(value, Decimal):
        raise ValueError("Settlement requires exact Decimal amounts")
    return validate_number(value, kind="PositiveMoney" if positive else "Money")


def plan_fifo(
    agency_id: int,
    amount: Decimal,
    invoices: tuple[Invoice, ...],
    checkpoint: tuple,
    *,
    allow_excess: bool = False,
    target_id: int | None = None,
) -> tuple[tuple[Allocation, ...], Decimal]:
    """Allocate explicit historical dues, never today's aggregate debt."""
    money(amount)
    if len({invoice.id for invoice in invoices}) != len(invoices):
        raise ValueError("Duplicate invoice")
    remaining, result = amount, []
    for invoice in sorted(invoices, key=lambda i: (i.business_date, i.business_order, i.id)):
        money(invoice.due, positive=False)
        if invoice.agency_id != agency_id:
            raise ValueError("Invoice agency differs")
        if (invoice.business_date, invoice.business_order) > checkpoint:
            continue
        if target_id is not None and invoice.id != target_id:
            continue
        allocated = min(remaining, invoice.due)
        if allocated:
            result.append(Allocation(invoice.id, allocated))
            remaining -= allocated
    if remaining and not allow_excess:
        raise ApiError(409, "PAYMENT_EXCEEDS_DEBT", "Amount exceeds eligible invoice debt")
    return tuple(result), remaining


def pair_credit_provenance(
    sources: tuple[CashSlice, ...], allocations: tuple[Allocation, ...]
) -> tuple[CashPair, ...]:
    """Conserved ordered sweep; caller orders lots and invoices once, explicitly."""
    for item in (*sources, *allocations):
        money(item.amount)
    if sum((x.amount for x in sources), Decimal(0)) != sum(
        (x.amount for x in allocations), Decimal(0)
    ):
        raise ValueError("Cash provenance does not conserve allocations")
    result, index, used = [], 0, Decimal(0)
    for allocation in allocations:
        remaining = allocation.amount
        while remaining:
            source = sources[index]
            paired = min(remaining, source.amount - used)
            result.append(CashPair(source.receipt_id, allocation.invoice_id, paired))
            remaining -= paired
            used += paired
            if used == source.amount:
                index += 1
                used = Decimal(0)
    return tuple(result)
