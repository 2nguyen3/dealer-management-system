from collections import defaultdict
from datetime import date
from decimal import Decimal, localcontext

from app.core.exceptions import ApiError
from app.modules.settlement_core.allocation import money, pair_credit_provenance, plan_fifo
from app.modules.settlement_core.models import (
    CashSlice,
    Event,
    Invoice,
    Leg,
    Lot,
    LotKey,
    ReplayPlan,
)

# Financial handlers are distinct from the later owning HTTP/rounding workflows.
CAPABILITIES = {
    "STOCK_RECEIPT": "financially neutral; inventory owned by M15",
    "STOCK_ADJUSTMENT": "financially neutral; inventory owned by M21/M22",
    "STOCK_ISSUE": "charge and atomic linked-auto receipt checkpoint",
    "PAYMENT_RECEIPT": "manual/online/separated FIFO and excess cash provenance",
    "SALES_RETURN": "frozen-total debt/credit split and cash provenance; lines owned by M23",
    "CREDIT_APPLICATION": "historical lot consumption and invoice FIFO with original cash",
    "REFUND": "protect exact consumed lots and active reservations; evidence owned by M27",
}


def validate_event(event: Event, agency_id: int) -> None:
    if (
        event.agency_id != agency_id
        or any(
            type(value) is not int
            for value in (event.document_id, event.revision_id, event.business_order, agency_id)
        )
        or min(event.document_id, event.revision_id, event.business_order, agency_id) <= 0
        or type(event.business_date) is not date
        or event.kind not in CAPABILITIES
    ):
        raise ValueError("Invalid financial event identity/kind")
    money(event.amount, positive=event.kind not in ("SALES_RETURN", "STOCK_ADJUSTMENT"))
    if event.kind == "PAYMENT_RECEIPT":
        if event.receipt_type not in ("AUTO_FROM_ISSUE", "DEBT_COLLECTION", "RECEIVED_UNAPPLIED"):
            raise ValueError("Invalid receipt type")
        if event.payment_method not in ("CASH", "BANK_TRANSFER", "ONLINE"):
            raise ValueError("Invalid payment method")
    if (event.kind in ("SALES_RETURN", "REFUND") or event.receipt_type == "AUTO_FROM_ISSUE") and (
        event.origin_id is None or event.origin_id <= 0
    ):
        raise ValueError("Financial source requires an origin")


def plan_replay(
    agency_id: int, events: tuple[Event, ...], lots: tuple[Lot, ...] = ()
) -> ReplayPlan:
    """Pure full-agency timeline oracle. Never edits frozen source content or cash evidence."""
    if len({e.document_id for e in events}) != len(events):
        raise ValueError("Duplicate financial source")
    for event in events:
        validate_event(event, agency_id)
    if len({lot.key for lot in lots}) != len(lots):
        raise ValueError("Duplicate credit lot")
    # Source values fit18 digits; sufficiently wide sums are exact across long timelines.
    with localcontext() as context:
        context.prec = 80
        return _timeline(agency_id, events, lots)


def _timeline(agency_id: int, events: tuple[Event, ...], lots: tuple[Lot, ...]) -> ReplayPlan:
    invoices, paid, available, metadata = {}, defaultdict(list), {}, {lot.key: lot for lot in lots}
    for lot in lots:
        money(lot.created, positive=False)
        money(lot.reserved, positive=False)
    protected = defaultdict(Decimal, {lot.key: lot.reserved for lot in lots})
    for source in events:
        for key, amount in source.refund_debits:
            money(amount)
            protected[key] += amount
    # Once a return creates credit its invoice is fully settled: no later payment
    # can add funding to that invoice. Earlier returns must retain cash earmarked
    # for later frozen returns of the same invoice, not just their own lots.
    future_returns = defaultdict(Decimal)
    for source in events:
        if source.kind == "SALES_RETURN":
            for lot in lots:
                if lot.key.revision_id == source.revision_id:
                    future_returns[(source.origin_id, lot.key.receipt_id)] += protected[lot.key]
    result = []
    ordered = sorted(
        events,
        key=lambda e: (
            e.business_date,
            e.business_order,
            1 if e.receipt_type == "AUTO_FROM_ISSUE" else 0,
            e.document_id,
        ),
    )
    for event in ordered:
        legs = []
        checkpoint = event.business_date, event.business_order
        if event.kind == "STOCK_ISSUE":
            invoices[event.document_id] = Invoice(
                event.document_id, agency_id, *checkpoint, event.amount
            )
            legs.append(Leg("receivable", "CHARGE", event.document_id, event.amount))
        elif event.kind in ("PAYMENT_RECEIPT", "CREDIT_APPLICATION"):
            if event.receipt_type == "AUTO_FROM_ISSUE":
                origin = invoices.get(event.origin_id)
                if origin is None or (origin.business_date, origin.business_order) != checkpoint:
                    raise ApiError(
                        409, "PAYMENT_SOURCE_CONFLICT", "Automatic receipt checkpoint differs"
                    )
            allocations, excess = plan_fifo(
                agency_id,
                event.amount,
                tuple(invoices.values()),
                checkpoint,
                allow_excess=event.receipt_type != "AUTO_FROM_ISSUE"
                and (
                    event.receipt_type == "RECEIVED_UNAPPLIED" or event.payment_method == "ONLINE"
                ),
                target_id=event.origin_id if event.receipt_type == "AUTO_FROM_ISSUE" else None,
            )
            if event.kind == "PAYMENT_RECEIPT":
                sources = tuple(CashSlice(event.document_id, a.amount) for a in allocations)
                if excess:
                    _create_credit(
                        event, event.document_id, excess, metadata, available, protected, legs
                    )
                entry_kind = "PAYMENT"
            else:
                sources = _consume_credit(event.amount, metadata, available, protected, legs)
                entry_kind = "CREDIT"
            for allocation in allocations:
                old = invoices[allocation.invoice_id]
                invoices[old.id] = Invoice(
                    old.id,
                    old.agency_id,
                    old.business_date,
                    old.business_order,
                    old.due - allocation.amount,
                )
                legs.append(Leg("receivable", entry_kind, old.id, -allocation.amount))
            for pair in pair_credit_provenance(sources, allocations):
                paid[pair.invoice_id].append(CashSlice(pair.receipt_id, pair.amount))
        elif event.kind == "SALES_RETURN":
            invoice = invoices.get(event.origin_id)
            if invoice is None:
                raise ApiError(409, "RETURN_SOURCE_CONFLICT", "Return precedes its invoice")
            reduction = min(invoice.due, event.amount)
            invoices[invoice.id] = Invoice(
                invoice.id,
                agency_id,
                invoice.business_date,
                invoice.business_order,
                invoice.due - reduction,
            )
            if reduction:
                legs.append(Leg("receivable", "RETURN", invoice.id, -reduction))
            remaining = event.amount - reduction
            # Retain existing return receipt origins when still supported by actual paid cash.
            preferences = [
                lot.key.receipt_id for lot in lots if lot.key.revision_id == event.revision_id
            ]
            cash = sorted(
                paid[invoice.id],
                key=lambda s: (
                    preferences.index(s.receipt_id)
                    if s.receipt_id in preferences
                    else len(preferences)
                ),
            )
            cash_by_receipt, required = defaultdict(Decimal), defaultdict(Decimal)
            for source in cash:
                cash_by_receipt[source.receipt_id] += source.amount
            source_lots = [lot for lot in lots if lot.key.revision_id == event.revision_id]
            for lot in source_lots:
                required[lot.key.receipt_id] += protected[lot.key]
            usable = {
                receipt_id: max(
                    cash_amount - (future_returns[(invoice.id, receipt_id)] - required[receipt_id]),
                    Decimal(0),
                )
                for receipt_id, cash_amount in cash_by_receipt.items()
            }
            if sum(required.values(), Decimal(0)) > remaining or any(
                value > usable.get(receipt_id, Decimal(0)) for receipt_id, value in required.items()
            ):
                code = (
                    "CREDIT_RESERVED"
                    if any(lot.reserved for lot in source_lots)
                    else "REFUND_SOURCE_CONFLICT"
                )
                raise ApiError(409, code, "Return replay invalidates protected receipt provenance")
            created = dict(required)
            remaining -= sum(required.values(), Decimal(0))
            for receipt_id, cash_amount in usable.items():
                used = min(remaining, cash_amount - required[receipt_id])
                created[receipt_id] = required[receipt_id] + used
                remaining -= used
            if remaining:
                raise ApiError(409, "RETURN_SOURCE_CONFLICT", "Return exceeds original paid value")
            for receipt_id, amount in created.items():
                if amount:
                    _create_credit(event, receipt_id, amount, metadata, available, protected, legs)
            for receipt_id, value in required.items():
                future_returns[(invoice.id, receipt_id)] -= value
            # Retain chronological paid legs, including repeated applications of one receipt.
            retained, taking = [], dict(created)
            for source in paid[invoice.id]:
                used = min(source.amount, taking.get(source.receipt_id, Decimal(0)))
                taking[source.receipt_id] = taking.get(source.receipt_id, Decimal(0)) - used
                if source.amount > used:
                    retained.append(CashSlice(source.receipt_id, source.amount - used))
            paid[invoice.id] = retained
        elif event.kind == "REFUND":
            if sum((amount for _, amount in event.refund_debits), Decimal(0)) != event.amount:
                raise ApiError(
                    409, "REFUND_SOURCE_CONFLICT", "Refund requires its consumed sources"
                )
            for key, amount in event.refund_debits:
                money(amount)
                if key.receipt_id != event.origin_id or available.get(key, Decimal(0)) < amount:
                    raise ApiError(
                        409, "REFUND_SOURCE_CONFLICT", "Replay invalidates paid refund source"
                    )
                available[key] -= amount
                protected[key] -= amount
                legs.append(Leg("credit", "REFUND", key, -amount))
        result.append((event, tuple(legs)))
    for key, lot in metadata.items():
        if available.get(key, Decimal(0)) < lot.reserved:
            raise ApiError(409, "CREDIT_RESERVED", "Replay invalidates reserved credit")
    debt = sum((i.due for i in invoices.values()), Decimal(0))
    credit = sum(available.values(), Decimal(0))
    try:
        money(debt, positive=False)
        money(credit, positive=False)
    except ValueError:
        raise ApiError(
            409, "BALANCE_OVERFLOW", "Posting exceeds the stored balance range"
        ) from None
    return ReplayPlan(agency_id, tuple(result), debt, credit)


def _create_credit(event, receipt_id, amount, metadata, available, protected, legs):
    candidates = sorted(
        (
            lot
            for lot in metadata.values()
            if lot.key.revision_id == event.revision_id and lot.key.receipt_id == receipt_id
        ),
        key=lambda lot: lot.key.id,
    )
    minimum = sum((protected[lot.key] for lot in candidates), Decimal(0))
    if minimum > amount:
        code = (
            "CREDIT_RESERVED"
            if any(lot.reserved for lot in candidates)
            else "REFUND_SOURCE_CONFLICT"
        )
        raise ApiError(409, code, "Replay invalidates protected cash source")
    remaining = amount - minimum
    assigned = {lot.key: protected[lot.key] for lot in candidates}
    for lot in candidates:
        used = min(remaining, max(lot.created - assigned[lot.key], Decimal(0)))
        if used > 0:
            assigned[lot.key] += used
            remaining -= used
    if remaining:
        # Reuse the final existing lot for any increase; identity/provenance is immutable.
        key = candidates[-1].key if candidates else LotKey(event.revision_id, receipt_id)
        if key not in metadata:
            ordinal = max((lot.key.id or lot.order_id for lot in metadata.values()), default=0) + 1
            metadata[key] = Lot(
                key, event.business_date, event.business_order, Decimal(0), order_id=ordinal
            )
        assigned[key] = assigned.get(key, Decimal(0)) + remaining
    for key, value in assigned.items():
        if value:
            available[key] = value
            legs.append(Leg("credit", "CREATED", key, value))


def _consume_credit(amount, metadata, available, protected, legs):
    remaining, sources = amount, []
    for lot in sorted(
        metadata.values(),
        key=lambda item: (item.business_date, item.key.id or item.order_id, item.key),
    ):
        used = min(
            remaining, max(available.get(lot.key, Decimal(0)) - protected[lot.key], Decimal(0))
        )
        if used:
            available[lot.key] -= used
            remaining -= used
            sources.append(CashSlice(lot.key.receipt_id, used))
            legs.append(Leg("credit", "OFFSET", lot.key, -used))
    if remaining:
        raise ApiError(409, "INSUFFICIENT_CREDIT", "Insufficient historical unreserved credit")
    return tuple(sources)
