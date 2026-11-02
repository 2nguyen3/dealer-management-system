from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True)
class Invoice:
    id: int
    agency_id: int
    business_date: date
    business_order: int
    due: Decimal


@dataclass(frozen=True)
class Allocation:
    invoice_id: int
    amount: Decimal


@dataclass(frozen=True)
class CashSlice:
    receipt_id: int
    amount: Decimal


@dataclass(frozen=True)
class CashPair:
    receipt_id: int
    invoice_id: int
    amount: Decimal


@dataclass(frozen=True, order=True)
class LotKey:
    revision_id: int
    receipt_id: int
    # Zero is a not-yet-persisted lot, never a database identity.
    id: int = 0


@dataclass(frozen=True)
class Lot:
    key: LotKey
    business_date: date
    business_order: int
    created: Decimal
    reserved: Decimal = Decimal(0)
    # New lots get a provisional ordinal in the same order persistence assigns IDs.
    order_id: int = 0


@dataclass(frozen=True)
class Event:
    document_id: int
    revision_id: int
    agency_id: int
    kind: str
    business_date: date
    business_order: int
    amount: Decimal
    origin_id: int | None = None
    receipt_type: str | None = None
    payment_method: str | None = None
    # Paid refunds retain the precise consumed reservation identities/amounts.
    refund_debits: tuple[tuple[LotKey, Decimal], ...] = ()


@dataclass(frozen=True)
class Leg:
    ledger: str
    kind: str
    target: int | LotKey
    amount: Decimal


@dataclass(frozen=True)
class ReplayPlan:
    agency_id: int
    sources: tuple[tuple[Event, tuple[Leg, ...]], ...]
    debt: Decimal
    credit: Decimal
