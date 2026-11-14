"""Seed v2 (handoff 6): realistic, chronological Agentra business history on a fresh 0011 schema.

The whole seed is ONE transaction under an advisory lock. Every document is created,
posted, cancelled or corrected through ``DocumentService`` (embedded savepoints) with
``dms.clock`` set to the business moment, so the business rules, balances and audit
trail are exactly those of the API. VNPAY evidence uses the online-payment repository
formats. A populated database is only verified. ``Random(20261114)`` makes a run on a
given date reproducible; history covers 01/06/2026 up to the day before the seed.
"""

from __future__ import annotations

import hashlib
import heapq
import json
import random
import secrets
import uuid
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from argon2 import PasswordHasher
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.values import rounded_amount
from app.core.config import get_settings
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.db import seed_data as data
from app.db.manifest import COMPATIBLE_HEAD
from app.db.session import build_engine
from app.db.verify import check_database
from app.modules.document_core.schemas import (
    IssueLineInput,
    PaymentReceiptInput,
    ReceiptLineInput,
    StockIssueCorrection,
    StockIssueInput,
    StockReceiptCorrection,
    StockReceiptInput,
)
from app.modules.document_core.service import DocumentService
from app.modules.online_payments.repository import OnlinePaymentRepository
from app.modules.online_payments.schemas import VerifiedPayment

VN = timezone(timedelta(hours=7))
HISTORY_START = date(2026, 6, 1)
SEED_RANDOM = 20261114
LOCK_KEY = 20261114
PHONE_PREFIXES = (
    "032 033 034 035 036 037 038 039 056 058 070 076 077 078 079 081 082 083 084 085 "
    "086 088 089 090 091 093 094 096 097 098"
).split()
DAY_END = time(17, 25)


def at(day: date, hour: int, minute: int, second: int = 0) -> datetime:
    return datetime.combine(day, time(hour, minute, second), VN)


class SeedError(RuntimeError):
    pass


class Seeder:
    def __init__(self, session: Session, today: date) -> None:
        self.s = session
        self.today = today
        self.end = today - timedelta(days=1)
        while not self.is_business_day(self.end):
            self.end -= timedelta(days=1)
        self.rng = random.Random(SEED_RANDOM)
        self.codec = CursorCodec(secrets.token_bytes(32))
        self.heap: list = []
        self.sequence = 0
        self.clock: datetime | None = None
        self.stats: Counter = Counter()
        self.users: dict[str, int] = {}
        self.grants: dict[int, set[str]] = {}
        self.units: dict[str, int] = {}
        self.products: dict[str, int] = {}
        self.product_keys: dict[int, str] = {}
        self.product_spec = {row[0]: row for row in data.PRODUCTS}
        self.types: dict[str, tuple[int, Decimal]] = {}
        self.agencies: dict[int, dict] = {}  # agency id -> profile record
        self.reserved_debt: defaultdict = defaultdict(Decimal)
        self.reserved_pay: defaultdict = defaultdict(Decimal)
        self.reserved_stock: defaultdict = defaultdict(Decimal)
        self.pending_receipt: defaultdict = defaultdict(Decimal)
        self.pending: dict[int, tuple] = {}
        self.closed_from: dict[int, date] = {}  # agency id -> first day without new issues
        self.payments_closed_from: dict[int, date] = {}
        self.txn_no = 14_806_000 + self.rng.randrange(5_000)
        self.business_days = self.days_between(HISTORY_START, self.end)
        self.daily_demand = self.demand_model()

    # ------------------------------------------------------------ calendar ----

    @staticmethod
    def is_business_day(day: date) -> bool:
        return day.weekday() < 6 and day not in data.HOLIDAYS

    def days_between(self, first: date, last: date) -> list[date]:
        days, day = [], first
        while day <= last:
            if self.is_business_day(day):
                days.append(day)
            day += timedelta(days=1)
        return days

    def next_business_day(self, day: date) -> date:
        day += timedelta(days=1)
        while not self.is_business_day(day):
            day += timedelta(days=1)
        return day

    def random_time(self, day: date, start=(7, 45), end=(16, 30)) -> datetime:
        low = start[0] * 3600 + start[1] * 60
        high = end[0] * 3600 + end[1] * 60
        seconds = self.rng.randrange(low, high)
        return at(day, seconds // 3600, seconds // 60 % 60, seconds % 60)

    def later(self, moment: datetime, low: int, high: int) -> datetime:
        """A later moment in business hours, moving to the next morning when needed."""
        candidate = moment + timedelta(
            minutes=self.rng.randint(low, high), seconds=self.rng.randrange(60)
        )
        if candidate.timetz().replace(tzinfo=None) <= DAY_END:
            return candidate
        day = moment.date()
        if day >= self.end:
            return moment + timedelta(minutes=self.rng.randint(2, 4))
        return self.random_time(self.next_business_day(day), (7, 40), (9, 30))

    # -------------------------------------------------------------- engine ----

    def schedule(self, moment: datetime, action, *args) -> None:
        self.sequence += 1
        heapq.heappush(self.heap, (moment, self.sequence, action, args))

    def set_clock(self, moment: datetime) -> None:
        if self.clock is not None and moment < self.clock:
            raise SeedError(f"Clock moved backwards: {moment} < {self.clock}")
        self.clock = moment
        self.s.execute(
            text("SELECT set_config('dms.clock', :value, true)"), {"value": moment.isoformat()}
        )

    def request_id(self) -> str:
        return str(uuid.UUID(int=self.rng.getrandbits(128), version=4))

    def context(self, actor: int | None, function_code: str) -> None:
        set_audit_context(self.s, actor, self.request_id(), function_code=function_code)

    def authorizer(self, actor: int | None):
        def authorize(required: tuple[str, ...]) -> None:
            if actor is not None and not set(required) <= self.grants[actor]:
                raise SeedError(f"Seed actor {actor} lacks {required}")

        return authorize

    def documents(self, kind: str, actor: int | None) -> DocumentService:
        return DocumentService(
            self.s,
            self.codec,
            actor,
            self.request_id(),
            self.authorizer(actor),
            kind=kind,
            embedded=True,
        )

    def run(self) -> None:
        while self.heap:
            moment, _, action, args = heapq.heappop(self.heap)
            self.set_clock(moment)
            action(moment, *args)

    # ------------------------------------------------------------- people ----

    def user(self, key: str) -> int:
        return self.users[key]

    def warehouse(self) -> int:
        return self.user(self.rng.choices(["giaphuc", "thuha", "quocbao"], [45, 35, 20])[0])

    def accountant(self) -> int:
        return self.user(self.rng.choices(["thuyngan", "ngochan", "thanhtung"], [40, 35, 25])[0])

    def salesperson(self, agency: dict, day: date) -> int:
        manager = agency["manager"]
        if manager == "vanluc" and day >= data.LUC_LOCKED:
            manager = "myduyen"
        colleagues = ["minhtuan", "hoangnam"] + (["myduyen"] if day >= data.DUYEN_JOINED else [])
        if day < data.LUC_LOCKED:
            colleagues.append("vanluc")
        if self.rng.random() < 0.12:
            manager = self.rng.choice(colleagues)
        return self.user(manager)

    # -------------------------------------------------------- master data ----

    def phone(self, used: set[str]) -> str:
        while True:
            digits = "".join(str(self.rng.randrange(10)) for _ in range(7))
            ascending = any(
                all(int(digits[i + k + 1]) == int(digits[i + k]) + 1 for k in range(3))
                for i in range(4)
            )
            number = self.rng.choice(PHONE_PREFIXES) + digits
            if not ascending and number not in used:
                used.add(number)
                return number

    def insert_user(self, moment: datetime, row, creator: int | None) -> None:
        email, name, group, password, _status = row
        self.context(creator, "users.manage")
        identifier = self.s.execute(
            text(
                'INSERT INTO dms.app_user ("fullName", email, "passwordHash", "groupId") '
                "VALUES (:name, :email, :hash, :group) RETURNING id"
            ),
            {
                "name": name,
                "email": email,
                "hash": self.hasher.hash(password),
                "group": self.groups[group],
            },
        ).scalar_one()
        self.users[email.split("@")[0]] = identifier
        self.load_grants()

    def load_grants(self) -> None:
        self.grants = {}
        rows = self.s.execute(
            text(
                "SELECT u.id, f.code FROM dms.app_user u JOIN dms.group_permission g ON "
                'g."groupId" = '
                'u."groupId" AND g."isAllowed" JOIN dms.app_function f ON f.id = g."functionId"'
            )
        ).all()
        for user_id, code in rows:
            self.grants.setdefault(user_id, set()).add(code)

    def seed_users(self) -> None:
        self.hasher = PasswordHasher()
        self.groups = dict(self.s.execute(text("SELECT code, id FROM dms.user_group")).all())
        moment = at(data.USER_CREATED, 8, 0)
        for row in data.USERS:
            if row[0].startswith("myduyen"):
                self.duyen = row  # joins later, through the timeline
                continue
            self.set_clock(moment)
            self.insert_user(moment, row, self.users.get("thaonguyen"))
            moment += timedelta(minutes=self.rng.randint(2, 6), seconds=self.rng.randrange(60))

    def seed_catalogue(self) -> None:
        for code, identifier, max_debt in self.s.execute(
            text('SELECT code, id, "maxDebt" FROM dms.agency_type')
        ).all():
            self.types[code] = (identifier, Decimal(max_debt))

    def insert_units(self) -> None:
        self.set_clock(at(data.PRODUCTS_CREATED, 8, 20))
        self.context(self.user("giaphuc"), "unit.manage")
        for code, name, fraction in data.UNITS:
            self.units[code] = self.s.execute(
                text(
                    'INSERT INTO dms.unit (code, name, "allowsFraction") VALUES (:c, :n, :f) '
                    "RETURNING id"
                ),
                {"c": code, "n": name, "f": fraction},
            ).scalar_one()

    def insert_product(self, moment: datetime, key: str) -> None:
        spec = self.product_spec[key]
        self.context(self.user(self.rng.choice(["giaphuc", "thuha"])), "product.manage")
        identifier = self.s.execute(
            text('INSERT INTO dms.product (name, "unitId") VALUES (:n, :u) RETURNING id'),
            {"n": spec[1], "u": self.units[spec[2]]},
        ).scalar_one()
        self.products[key] = identifier
        self.product_keys[identifier] = key

    def insert_products(self) -> None:
        moment = at(data.PRODUCTS_CREATED, 8, 40)
        for key, *_ in data.PRODUCTS:
            if key in data.LATE_PRODUCTS:
                continue
            moment += timedelta(minutes=self.rng.randint(2, 9), seconds=self.rng.randrange(60))
            self.set_clock(moment)
            self.insert_product(moment, key)

    def insert_agency(self, moment: datetime, record: dict) -> None:
        wards = self.ward_ids
        type_id, max_debt = self.types[record["type"]]
        number = self.rng.randint(12, 480)
        house = f"{number}/{self.rng.randint(2, 40)}" if self.rng.random() < 0.3 else str(number)
        ward_name = self.ward_names[record["ward"]]
        actor = self.user(
            record["manager"]
            if record["manager"] != "vanluc" or moment.date() < data.LUC_LOCKED
            else "myduyen"
        )
        self.context(actor, "agency.manage")
        identifier = self.s.execute(
            text(
                'INSERT INTO dms.agency (name, "typeId", "wardId", phone, address, email, '
                '"acceptedDate", "createdBy", "updatedBy") VALUES (:name, :type, :ward, :phone, '
                ":address, :email, :accepted, :actor, :actor) RETURNING id"
            ),
            {
                "name": record["name"],
                "type": type_id,
                "ward": wards[record["ward"]],
                "phone": self.phone(self.used_phones),
                "address": f"{house} {record['street']}, {ward_name}, TP.HCM",
                "email": record["email"],
                "accepted": record["accepted"],
                "actor": actor,
            },
        ).scalar_one()
        record.update(id=identifier, maxDebt=max_debt)
        self.agencies[identifier] = record

    def prepare_agencies(self) -> list[dict]:
        self.ward_ids = dict(self.s.execute(text("SELECT code, id FROM dms.ward")).all())
        self.ward_names = dict(self.s.execute(text("SELECT code, name FROM dms.ward")).all())
        self.used_phones: set[str] = set()
        records = []
        for name, ward, kind, street, accepted, profile, manager, email in data.AGENCIES:
            if street not in data.STREETS[ward]:
                raise SeedError(f"Street {street} is not registered for ward {ward}")
            records.append(
                {
                    "name": name,
                    "ward": ward,
                    "type": kind,
                    "street": street,
                    "accepted": date.fromisoformat(accepted),
                    "profile": profile,
                    "manager": manager,
                    "email": email,
                }
            )
        for record in records:
            self.ending_dates(record)
        return records

    def business_day_before(self, day: date) -> date:
        day -= timedelta(days=1)
        while not self.is_business_day(day):
            day -= timedelta(days=1)
        return day

    def ending_dates(self, record: dict) -> None:
        """Dates when an agency stops ordering/paying and is settled (handoff 6.4)."""
        profile = record["profile"]
        if profile == "T":
            when = data.TERMINATIONS[record["name"]][0]
            settle = self.business_day_before(when - timedelta(days=2))
            record.update(close_issues=when - timedelta(days=20), settle=settle)
            record["close_payments"] = settle + timedelta(days=1)
        elif profile == "Z":
            settle = self.rng.choice([date(2026, 11, d) for d in (5, 6, 9, 10, 11, 12)])
            settle = min(settle, self.end)
            record.update(close_issues=settle - timedelta(days=3), settle=settle)
            record["close_payments"] = settle + timedelta(days=1)
        elif profile == "X":
            settle = min(data.NEGATIVE_DAY, self.end)
            record.update(
                close_issues=settle - timedelta(days=2),
                close_payments=settle - timedelta(days=2),
                settle=settle,
            )

    # ------------------------------------------------------------ queries ----

    def agency_state(self, identifier: int):
        return self.s.execute(
            text(
                'SELECT a.debt, t."maxDebt", a.status FROM dms.agency a JOIN dms.agency_type t '
                'ON t.id = a."typeId" WHERE a.id = :id'
            ),
            {"id": identifier},
        ).one()

    def product_states(self) -> dict[int, tuple]:
        return {
            row[0]: (Decimal(row[1]), row[2], row[3])
            for row in self.s.execute(
                text('SELECT id, stock, "lastPurchasePrice", status FROM dms.product')
            ).all()
        }

    def selling_rate(self) -> Decimal:
        return Decimal(
            self.s.execute(text('SELECT "sellingPriceRate" FROM dms.business_rule')).scalar_one()
        )

    def document(self, identifier: int):
        return (
            self.s.execute(text("SELECT * FROM dms.document WHERE id = :id"), {"id": identifier})
            .mappings()
            .one()
        )

    def lines(self, identifier: int):
        return (
            self.s.execute(
                text(
                    'SELECT "productId", quantity, "unitPrice" FROM dms.document_line '
                    'WHERE "documentId" = :id ORDER BY "lineNo"'
                ),
                {"id": identifier},
            )
            .mappings()
            .all()
        )

    # ------------------------------------------------------------ demand ----

    def weight_on(self, key: str, day: date) -> float:
        spec = self.product_spec[key]
        if key == data.NEVER_RECEIVED:
            return 0.0
        if key == "trung_thu":
            start, end = data.MOONCAKE_SEASON
            if not start <= day <= end:
                return 0.0
            return 9.0 if day.month == 9 else 4.0
        if key in data.DISCONTINUED and day >= data.DISCONTINUED[key][1]:
            return 0.0
        return float(spec[5])

    def demand_model(self) -> dict[str, float]:
        """Expected units per business day of each product (used for reordering)."""
        months = Counter(day.month for day in self.days_between(HISTORY_START, date(2026, 11, 30)))
        issues_per_day = sum(data.MONTHLY_ISSUES.values()) / sum(months.values())
        weights = {
            key: float(spec[5]) for key, *_ in data.PRODUCTS for spec in [self.product_spec[key]]
        }
        weights["trung_thu"] = 7.0
        total = sum(weights.values())
        demand = {}
        for key, spec in self.product_spec.items():
            low, high, _step = spec[6]
            share = min(0.9, 3.4 * weights[key] / total)
            demand[key] = issues_per_day * share * (float(low) + float(high)) / 2 * 1.2
        return demand

    def price_on(self, key: str, day: date) -> Decimal:
        price = self.product_spec[key][4]
        for effective, value in data.PRICE_CHANGES.get(key, []):
            if day >= effective:
                price = value
        return Decimal(price)

    def can_restock(self, key: str, day: date) -> bool:
        if key not in self.products or key == data.NEVER_RECEIVED:
            return False
        if key in data.DISCONTINUED and day > data.DISCONTINUED[key][0]:
            return False
        if key == "trung_thu" and day < date(2026, 8, 5):
            return False
        return True

    # ---------------------------------------------------------- receipts ----

    def reorder_lines(self, group: str, day: date, *, opening: bool) -> list[ReceiptLineInput]:
        states = self.product_states()
        lines = []
        for key, spec in self.product_spec.items():
            if spec[3] != group or not self.can_restock(key, day):
                continue
            identifier = self.products[key]
            demand = self.daily_demand[key]
            if key == "trung_thu":
                demand = 14.0
            projected = (
                states[identifier][0]
                + self.pending_receipt[identifier]
                - self.reserved_stock[identifier]
            )
            if not opening and projected >= Decimal(demand * 18):
                continue
            step = Decimal(str(spec[6][2]))
            step = max(step, Decimal(1))
            wanted = Decimal(demand * (22 if opening else 30)) - projected
            if wanted <= 0:
                continue
            quantity = (wanted / step).to_integral_value(rounding="ROUND_CEILING") * step
            quantity = max(quantity, Decimal(spec[6][1]))
            lines.append(
                ReceiptLineInput(
                    productId=str(identifier), quantity=quantity, unitPrice=self.price_on(key, day)
                )
            )
        return lines

    def needs_reorder(self, group: str, day: date) -> float:
        states = self.product_states()
        urgency = 0.0
        for key, spec in self.product_spec.items():
            if spec[3] != group or not self.can_restock(key, day):
                continue
            identifier = self.products[key]
            demand = max(self.daily_demand[key], 0.1)
            projected = float(
                states[identifier][0]
                + self.pending_receipt[identifier]
                - self.reserved_stock[identifier]
            )
            days_left = projected / demand
            if key == "trung_thu" and day <= date(2026, 9, 16):
                days_left = min(days_left, 5.0) if projected < 120 else days_left
            if days_left < 4:
                urgency = max(urgency, 4 - days_left)
        return urgency

    def create_receipt(
        self, moment: datetime, group: str, opening: bool = False, note=None
    ) -> None:
        day = moment.date()
        lines = self.reorder_lines(group, day, opening=opening)
        if not lines:
            return
        actor = self.warehouse()
        if note is None and self.rng.random() < 0.15:
            note = data.RECEIPT_NOTES[group]
        identifier = self.documents("STOCK_RECEIPT", actor).create(
            StockReceiptInput(businessDate=day, note=note, lines=lines)
        )
        for line in lines:
            self.pending_receipt[int(line.productId)] += line.quantity
        self.pending[identifier] = (
            "STOCK_RECEIPT",
            None,
            Decimal(0),
            {int(x.productId): x.quantity for x in lines},
        )
        self.schedule(self.later(moment, 20, 150), self.post, "STOCK_RECEIPT", identifier)

    # ------------------------------------------------------------ issues ----

    def release(self, identifier: int) -> None:
        kind, agency, amount, quantities = self.pending.pop(identifier)
        if kind == "STOCK_ISSUE":
            self.reserved_debt[agency] -= amount
            for product, quantity in quantities.items():
                self.reserved_stock[product] -= quantity
        elif kind == "STOCK_RECEIPT":
            for product, quantity in quantities.items():
                self.pending_receipt[product] -= quantity
        else:
            self.reserved_pay[agency] -= amount

    def post(self, moment: datetime, kind: str, identifier: int) -> None:
        actor = self.accountant() if kind == "PAYMENT_RECEIPT" else self.warehouse()
        self.release(identifier)
        try:
            self.documents(kind, actor).post(identifier, None)
            self.stats[f"posted:{kind}"] += 1
        except ApiError as error:
            # The plan reserved stock/debt, so this is a seed bug or a rare race with a
            # cancellation; withdraw the draft like a clerk would and record it.
            self.stats[f"withdrawn:{kind}:{error.code}"] += 1
            creator = self.document(identifier)["createdBy"]
            self.documents(kind, creator).delete(identifier, None)

    def available(self, states, identifier: int) -> Decimal:
        return states[identifier][0] - self.reserved_stock[identifier]

    def issue_lines(self, agency: dict, day: date, room: Decimal, *, target=None, keys=None):
        """Choose issue lines that fit current stock and the agency's remaining room."""
        states = self.product_states()
        rate = self.selling_rate()
        big = agency["type"] == "TYPE_1"
        candidates = []
        for key, identifier in self.products.items():
            state = states[identifier]
            if state[1] is None or state[2] != "ACTIVE":
                continue
            weight = self.weight_on(key, day)
            if keys is not None:
                weight = 1.0 if key in keys else 0.0
            low = Decimal(str(self.product_spec[key][6][0]))
            if weight <= 0 or self.available(states, identifier) < low:
                continue
            candidates.append((key, identifier, weight))
        if not candidates:
            return []
        count = self.rng.randint(3, 6) if big else self.rng.randint(2, 4)
        if target is not None:
            count = len(candidates)
        chosen = []
        pool = list(candidates)
        while pool and len(chosen) < count:
            pick = self.rng.choices(pool, [c[2] for c in pool])[0]
            pool.remove(pick)
            chosen.append(pick)
        lines = []
        for key, identifier, _ in chosen:
            low, high, step = self.product_spec[key][6]
            step = Decimal(str(step))
            low = Decimal(str(low))
            high = Decimal(str(high)) * (Decimal("1.5") if big else 1)
            steps = int((high - low) / step)
            quantity = low + step * self.rng.randint(0, max(steps, 0))
            limit = (self.available(states, identifier) / step).to_integral_value(
                rounding="ROUND_FLOOR"
            ) * step
            quantity = min(quantity, limit)
            if quantity < low:
                continue
            price = rounded_amount(Decimal(states[identifier][1]), rate)
            lines.append([identifier, quantity, price, step, low])

        def total():
            return sum((rounded_amount(q, p) for _, q, p, _, _ in lines), Decimal(0))

        goal = room if target is None else min(room, target)
        while lines and total() > goal:
            line = max(lines, key=lambda x: rounded_amount(x[1], x[2]))
            line[1] -= line[3]
            if line[1] < line[4]:
                lines.remove(line)
        return [(identifier, quantity, price) for identifier, quantity, price, _, _ in lines]

    def issuable_agencies(self, day: date) -> list[dict]:
        result = []
        for record in self.agencies.values():
            if record["profile"] == "W" or record.get("terminated"):
                continue
            if record["accepted"] >= day:
                continue
            if day >= self.closed_from.get(record["id"], date.max):
                continue
            result.append(record)
        return result

    def create_issue(self, moment: datetime) -> None:
        day = moment.date()
        candidates = self.issuable_agencies(day)
        for _ in range(6):
            if not candidates:
                break
            weights = []
            for record in candidates:
                debt, max_debt, _ = self.agency_state(record["id"])
                room = Decimal(max_debt) - Decimal(debt) - self.reserved_debt[record["id"]]
                ratio = max(float(room / Decimal(max_debt)), 0.02)
                base = 2.2 if record["type"] == "TYPE_1" else 1.0
                if record["profile"] == "H":
                    base *= 1.4
                    ratio = max(ratio, 0.3)
                weights.append(base * ratio**0.7)
            record = self.rng.choices(candidates, weights)[0]
            if self.issue_for(moment, record):
                return
            candidates.remove(record)
        self.stats["skipped:issue"] += 1

    def issue_for(
        self, moment: datetime, record: dict, *, target=None, keys=None, note=None
    ) -> bool:
        day = moment.date()
        debt, max_debt, status = self.agency_state(record["id"])
        if status != "ACTIVE":
            return False
        margin = Decimal(0) if record["profile"] == "H" else Decimal(max_debt) * Decimal("0.03")
        room = Decimal(max_debt) - Decimal(debt) - self.reserved_debt[record["id"]] - margin
        room = room * Decimal("0.97")  # leave space for a price change before posting
        if room < 600_000 and target is None:
            return False
        lines = self.issue_lines(record, day, room, target=target, keys=keys)
        if not lines:
            return False
        amount = sum((rounded_amount(q, p) for _, q, p in lines), Decimal(0))
        if target is None and amount < 400_000:
            return False
        if note is None and self.rng.random() < 0.12:
            note = self.rng.choice(data.ISSUE_NOTES)
        actor = self.salesperson(record, day)
        identifier = self.documents("STOCK_ISSUE", actor).create(
            StockIssueInput(
                agencyId=str(record["id"]),
                businessDate=day,
                note=note,
                lines=[IssueLineInput(productId=str(i), quantity=q) for i, q, _ in lines],
            )
        )
        quantities = {i: q for i, q, _ in lines}
        self.reserved_debt[record["id"]] += amount
        for product, quantity in quantities.items():
            self.reserved_stock[product] += quantity
        self.pending[identifier] = ("STOCK_ISSUE", record["id"], amount, quantities)
        self.schedule(self.later(moment, 15, 180), self.post, "STOCK_ISSUE", identifier)
        return True

    # ---------------------------------------------------------- payments ----

    def payable(self, identifier: int) -> Decimal:
        debt, _, _ = self.agency_state(identifier)
        return Decimal(debt) - self.reserved_pay[identifier] - self.reserved_debt_cancel(identifier)

    def reserved_debt_cancel(self, identifier: int) -> Decimal:
        return Decimal(0)

    def create_payment(self, moment: datetime, agency_id: int, amount=None, kind=None, note=None):
        available = self.payable(agency_id)
        if amount is None:
            if available < 300_000:
                return None
            if self.rng.random() < 0.25:
                amount = available
            else:
                amount = (
                    available * Decimal(str(self.rng.uniform(0.35, 0.9))) / 100_000
                ).to_integral_value(rounding="ROUND_FLOOR") * 100_000
                amount = max(amount, Decimal(300_000))
        if amount <= 0 or amount > available:
            return None
        kind = kind or ("CASH" if self.rng.random() < 0.55 else "BANK_TRANSFER")
        if note is None and self.rng.random() < 0.2:
            note = self.rng.choice(data.PAYMENT_NOTES)
            if kind == "CASH" and "huyển khoản" in note:
                note = None
        actor = self.accountant()
        identifier = self.documents("PAYMENT_RECEIPT", actor).create(
            PaymentReceiptInput(
                agencyId=str(agency_id),
                businessDate=moment.date(),
                receiptType=kind,
                amount=amount,
                note=note,
            )
        )
        self.reserved_pay[agency_id] += amount
        self.pending[identifier] = ("PAYMENT_RECEIPT", agency_id, amount, {})
        return identifier

    def payment_then_post(
        self, moment: datetime, agency_id: int, amount=None, kind=None, note=None
    ):
        identifier = self.create_payment(moment, agency_id, amount, kind, note)
        if identifier is not None:
            self.schedule(self.later(moment, 4, 70), self.post, "PAYMENT_RECEIPT", identifier)
        return identifier

    def payment_probability(self, record: dict, day: date, ratio: float) -> float:
        profile = record["profile"]
        if profile in ("U", "W"):
            return 0.0
        if profile == "H":
            if day >= date(2026, 11, 1):
                return 0.0
            return 0.16 if ratio > 0.85 else 0.015
        if ratio < 0.12:
            return 0.0
        if ratio < 0.35:
            return 0.035
        if ratio < 0.6:
            return 0.09
        return 0.22

    # ------------------------------------------------------------ VNPAY ----

    def evidence(self, reference: str, amount: Decimal, status: str, transaction: str, paid=None):
        payload = {
            "merchantReference": reference,
            "amount": str(int(amount)),
            "providerTransactionId": transaction,
            "status": status,
        }
        if paid is not None:
            payload["paymentTime"] = paid.isoformat()
        key = "vnpay:" + hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        return VerifiedPayment(eventKey=key, **payload)

    def start_online(
        self, moment: datetime, agency_id: int, amount: Decimal, outcome: str, delay=None
    ) -> None:
        actor = self.accountant()
        self.context(actor, "payments.online")
        repository = OnlinePaymentRepository(self.s)
        key = uuid.UUID(int=self.rng.getrandbits(128), version=4)
        identifier = repository.create(agency_id, "VNPAY", amount, actor, key, 900)
        if outcome == "SUCCESS":
            self.reserved_pay[agency_id] += amount
            finish = moment + timedelta(
                minutes=self.rng.randint(2, 9), seconds=self.rng.randrange(60)
            )
        elif outcome == "FAILED":
            finish = moment + timedelta(
                minutes=self.rng.randint(1, 6), seconds=self.rng.randrange(60)
            )
        else:
            finish = moment + timedelta(
                minutes=self.rng.randint(24, 70), seconds=self.rng.randrange(60)
            )
        if delay is not None:
            finish = moment + timedelta(
                minutes=self.rng.randint(*delay), seconds=self.rng.randrange(60)
            )
        self.stats[f"online:{outcome}"] += 1
        self.schedule(finish, self.finish_online, identifier, agency_id, amount, outcome, actor)

    def finish_online(self, moment, identifier, agency_id, amount, outcome, starter) -> None:
        repository = OnlinePaymentRepository(self.s)
        reference = self.s.execute(
            text('SELECT "merchantReference" FROM dms.online_payment WHERE id = :id'),
            {"id": identifier},
        ).scalar_one()
        savepoint = self.s.begin_nested()
        if outcome == "SUCCESS":
            self.reserved_pay[agency_id] -= amount
            self.txn_no += self.rng.randint(40, 900)
            transaction = str(self.txn_no)
            paid = (moment - timedelta(seconds=self.rng.randint(4, 40))).replace(microsecond=0)
            self.context(None, "payments.online")
            evidence = self.evidence(reference, amount, "SUCCESS", transaction, paid)
            repository.append_event(identifier, evidence)
            receipt = self.documents("PAYMENT_RECEIPT", None).record_online_receipt(
                agency_id,
                amount,
                business_date=paid.date(),
                note=f"VNPAY {reference}",
                created_by=starter,
            )
            repository.mark_success(identifier, transaction, paid, receipt)
        else:
            # FAILED: the customer cancelled on the VNPAY page (response code 24).
            # EXPIRED: the checkout timed out and the accountant reconciled it.
            actor = None if outcome == "FAILED" else starter
            self.context(actor, "payments.online")
            evidence = self.evidence(reference, amount, outcome, "0")
            repository.append_event(identifier, evidence)
            repository.mark_unsuccessful(identifier, outcome, None)
        self.s.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        self.s.execute(text("SET CONSTRAINTS ALL DEFERRED"))
        savepoint.commit()

    def planned_online(self, moment: datetime, outcome: str) -> None:
        day = moment.date()
        choices = [
            record
            for record in self.agencies.values()
            if record["profile"] in ("N", "H")
            and record.get("id")
            and not record.get("terminated")
            and record["accepted"] < day
            and self.payable(record["id"]) >= 2_000_000
        ]
        if not choices:
            self.stats["skipped:online"] += 1
            return
        record = self.rng.choice(choices)
        available = self.payable(record["id"])
        amount = (available * Decimal(str(self.rng.uniform(0.3, 0.7))) / 100_000).to_integral_value(
            rounding="ROUND_FLOOR"
        ) * 100_000
        self.start_online(moment, record["id"], amount, outcome)

    # --------------------------------------------------- manager actions ----

    def recent(self, kind: str, day: date, *, receipt_type=None, minimum_lines=1):
        rows = (
            self.s.execute(
                text(
                    "SELECT d.id FROM dms.document d WHERE d.kind = :kind AND d.status = 'POSTED' "
                    'AND d."businessDate" >= :start AND d."businessDate" <= :day '
                    'AND (CAST(:rtype AS text) IS NULL OR d."receiptType" = :rtype) '
                    "AND coalesce(d.\"receiptType\", '') <> 'ONLINE' "
                    'AND (SELECT count(*) FROM dms.document_line l WHERE l."documentId" = d.id) '
                    ">= :lines "
                    'ORDER BY d."postedAt" DESC LIMIT 12'
                ),
                {
                    "kind": kind,
                    "start": max(day.replace(day=1), day - timedelta(days=3)),
                    "day": day,
                    "rtype": receipt_type,
                    "lines": minimum_lines if kind != "PAYMENT_RECEIPT" else 0,
                },
            )
            .scalars()
            .all()
        )
        result = []
        for identifier in rows:
            document = self.document(identifier)
            if document["agencyId"] is not None:
                record = self.agencies[document["agencyId"]]
                if record["profile"] in ("Z", "X", "T") and day >= date(2026, 9, 1):
                    continue
            result.append(identifier)
        return result

    def receipt_cancellable(self, identifier: int, extra=None) -> bool:
        states = self.product_states()
        for line in self.lines(identifier):
            stock = states[line["productId"]][0] - self.reserved_stock[line["productId"]]
            if extra is not None:
                stock += extra.get(line["productId"], 0)
            if stock < line["quantity"]:
                return False
        return True

    def manager(self) -> int:
        return self.user("thaonguyen")

    def cancel(self, moment: datetime, kind: str, identifier: int, reason: str) -> None:
        self.documents(kind, self.manager()).cancel(identifier, reason, None)
        self.stats[f"cancelled:{kind}"] += 1

    def special(self, moment: datetime, action: str, reason: str) -> None:
        day = moment.date()
        if action == "cancel_issue":
            for identifier in self.recent("STOCK_ISSUE", day):
                self.cancel(moment, "STOCK_ISSUE", identifier, reason)
                return
        elif action == "correct_issue":
            for identifier in self.recent("STOCK_ISSUE", day, minimum_lines=2):
                lines = [dict(line) for line in self.lines(identifier)]
                if "bớt một mặt hàng" in reason:
                    lines.pop()
                else:
                    index = (
                        0
                        if "dòng 1" in reason
                        else (
                            1
                            if "dòng 2" in reason
                            else max(
                                range(len(lines)),
                                key=lambda i: lines[i]["quantity"] * lines[i]["unitPrice"],
                            )
                        )
                    )
                    key = self.product_keys[lines[index]["productId"]]
                    step = Decimal(str(self.product_spec[key][6][2]))
                    reduced = lines[index]["quantity"] - step * self.rng.randint(1, 2)
                    if reduced <= 0:
                        continue
                    lines[index]["quantity"] = reduced
                body = StockIssueCorrection(
                    reason=reason,
                    lines=[
                        IssueLineInput(productId=str(x["productId"]), quantity=x["quantity"])
                        for x in lines
                    ],
                )
                self.documents("STOCK_ISSUE", self.manager()).correct(identifier, body, None)
                self.stats["corrected:STOCK_ISSUE"] += 1
                return
        elif action == "cancel_receipt":
            # A supplier delivery is recorded, then sent back the same day (wrong pack size).
            groups = sorted({spec[3] for spec in self.product_spec.values()})
            group = max(groups, key=lambda g: (self.needs_reorder(g, day), g))
            lines = self.reorder_lines(group, day, opening=True)[:3]
            if lines:
                identifier = self.documents("STOCK_RECEIPT", self.warehouse()).create(
                    StockReceiptInput(businessDate=day, lines=lines)
                )
                quantities = {int(x.productId): x.quantity for x in lines}
                for product, quantity in quantities.items():
                    self.pending_receipt[product] += quantity
                self.pending[identifier] = ("STOCK_RECEIPT", None, Decimal(0), quantities)
                posted = moment + timedelta(minutes=self.rng.randint(15, 35))
                self.schedule(posted, self.post, "STOCK_RECEIPT", identifier)
                for product, quantity in quantities.items():
                    self.reserved_stock[product] += quantity
                self.schedule(
                    posted + timedelta(hours=3, minutes=self.rng.randint(0, 50)),
                    self.cancel_duplicate_receipt,
                    identifier,
                    quantities,
                    reason,
                )
                return
        elif action == "correct_receipt":
            for identifier in self.recent("STOCK_RECEIPT", day, minimum_lines=2):
                lines = [dict(line) for line in self.lines(identifier)]
                old = lines[1]["quantity"]
                key = self.product_keys[lines[1]["productId"]]
                step = max(Decimal(str(self.product_spec[key][6][2])), Decimal(1))
                reduced = ((old * Decimal("0.85")) / step).to_integral_value(
                    rounding="ROUND_FLOOR"
                ) * step
                if reduced <= 0 or reduced >= old:
                    continue
                lines[1]["quantity"] = reduced
                states = self.product_states()
                product = lines[1]["productId"]
                if states[product][0] - self.reserved_stock[product] < old - reduced:
                    continue
                body = StockReceiptCorrection(
                    reason=reason,
                    lines=[
                        ReceiptLineInput(
                            productId=str(x["productId"]),
                            quantity=x["quantity"],
                            unitPrice=x["unitPrice"],
                        )
                        for x in lines
                    ],
                )
                self.documents("STOCK_RECEIPT", self.manager()).correct(identifier, body, None)
                self.stats["corrected:STOCK_RECEIPT"] += 1
                return
        elif action == "duplicate_issue":
            for identifier in self.recent("STOCK_ISSUE", day):
                original = self.document(identifier)
                record = self.agencies[original["agencyId"]]
                lines = self.lines(identifier)
                states = self.product_states()
                debt, max_debt, _ = self.agency_state(record["id"])
                room = Decimal(max_debt) - Decimal(debt) - self.reserved_debt[record["id"]]
                fits = (
                    all(self.available(states, x["productId"]) >= x["quantity"] for x in lines)
                    and Decimal(original["totalAmount"]) * Decimal("1.02") < room
                )
                if not fits:
                    continue
                actor = original["createdBy"]
                if actor == self.users["vanluc"] and day >= data.LUC_LOCKED:
                    actor = self.users["myduyen"]
                duplicate = self.documents("STOCK_ISSUE", actor).create(
                    StockIssueInput(
                        agencyId=str(record["id"]),
                        businessDate=day,
                        lines=[
                            IssueLineInput(productId=str(x["productId"]), quantity=x["quantity"])
                            for x in lines
                        ],
                    )
                )
                amount = Decimal(original["totalAmount"]) * Decimal("1.02")
                quantities = {x["productId"]: x["quantity"] for x in lines}
                self.reserved_debt[record["id"]] += amount
                for product, quantity in quantities.items():
                    self.reserved_stock[product] += quantity
                self.pending[duplicate] = ("STOCK_ISSUE", record["id"], amount, quantities)
                posted = moment + timedelta(minutes=self.rng.randint(12, 30))
                self.schedule(posted, self.post, "STOCK_ISSUE", duplicate)
                self.schedule(
                    posted + timedelta(minutes=self.rng.randint(50, 110)),
                    self.cancel,
                    "STOCK_ISSUE",
                    duplicate,
                    f"Lập trùng với {original['code']}, đại lý chỉ đặt một đơn",
                )
                return
        elif action == "duplicate_receipt":
            for identifier in self.recent("STOCK_RECEIPT", day):
                original = self.document(identifier)
                lines = self.lines(identifier)
                duplicate = self.documents("STOCK_RECEIPT", self.warehouse()).create(
                    StockReceiptInput(
                        businessDate=day,
                        lines=[
                            ReceiptLineInput(
                                productId=str(x["productId"]),
                                quantity=x["quantity"],
                                unitPrice=x["unitPrice"],
                            )
                            for x in lines
                        ],
                    )
                )
                quantities = {x["productId"]: x["quantity"] for x in lines}
                for product, quantity in quantities.items():
                    self.pending_receipt[product] += quantity
                self.pending[duplicate] = ("STOCK_RECEIPT", None, Decimal(0), quantities)
                posted = moment + timedelta(minutes=self.rng.randint(10, 25))
                self.schedule(posted, self.post, "STOCK_RECEIPT", duplicate)
                # Reserve the duplicated quantities so no issue consumes them before the cancel.
                for product, quantity in quantities.items():
                    self.reserved_stock[product] += quantity
                self.schedule(
                    posted + timedelta(minutes=self.rng.randint(40, 80)),
                    self.cancel_duplicate_receipt,
                    duplicate,
                    quantities,
                    f"Lập trùng với {original['code']} của nhà cung cấp",
                )
                return
        elif action == "wrong_agency_payment":
            choices = [
                r
                for r in self.agencies.values()
                if r["profile"] == "N"
                and r.get("id")
                and not r.get("terminated")
                and r["accepted"] < day
                and self.payable(r["id"]) >= 3_000_000
            ]
            if len(choices) >= 2:
                intended, wrong = self.rng.sample(choices, 2)
                amount = min(self.payable(intended["id"]), self.payable(wrong["id"]))
                amount = (amount * Decimal("0.5") / 100_000).to_integral_value(
                    rounding="ROUND_FLOOR"
                ) * 100_000
                identifier = self.create_payment(moment, wrong["id"], amount, "CASH")
                posted = moment + timedelta(minutes=self.rng.randint(4, 10))
                self.schedule(posted, self.post, "PAYMENT_RECEIPT", identifier)
                cancelled = posted + timedelta(minutes=self.rng.randint(45, 80))
                self.schedule(cancelled, self.cancel, "PAYMENT_RECEIPT", identifier, reason)
                self.schedule(
                    cancelled + timedelta(minutes=self.rng.randint(8, 20)),
                    self.redo_payment,
                    intended["id"],
                    amount,
                    identifier,
                )
                return
        elif action == "cancel_transfer":
            choices = [
                r
                for r in self.agencies.values()
                if r["profile"] == "N"
                and r.get("id")
                and not r.get("terminated")
                and r["accepted"] < day
                and self.payable(r["id"]) >= 2_000_000
            ]
            if choices:
                record = self.rng.choice(choices)
                amount = (self.payable(record["id"]) * Decimal("0.4") / 100_000).to_integral_value(
                    rounding="ROUND_FLOOR"
                ) * 100_000
                identifier = self.create_payment(moment, record["id"], amount, "BANK_TRANSFER")
                posted = moment + timedelta(minutes=self.rng.randint(5, 15))
                self.schedule(posted, self.post, "PAYMENT_RECEIPT", identifier)
                self.schedule(
                    posted + timedelta(hours=5, minutes=self.rng.randint(0, 40)),
                    self.cancel,
                    "PAYMENT_RECEIPT",
                    identifier,
                    reason,
                )
                return
        self.stats[f"missed:{action}"] += 1

    def cancel_duplicate_receipt(self, moment, identifier, quantities, reason) -> None:
        for product, quantity in quantities.items():
            self.reserved_stock[product] -= quantity
        self.cancel(moment, "STOCK_RECEIPT", identifier, reason)

    def redo_payment(self, moment, agency_id, amount, wrong_id) -> None:
        code = self.document(wrong_id)["code"]
        identifier = self.create_payment(
            moment, agency_id, amount, "CASH", f"Lập lại thay {code} do ghi nhầm đại lý"
        )
        if identifier is not None:
            self.schedule(
                moment + timedelta(minutes=self.rng.randint(3, 8)),
                self.post,
                "PAYMENT_RECEIPT",
                identifier,
            )

    # ------------------------------------------------- scripted endings ----

    def settle(self, moment: datetime, agency_id: int, *, close: bool = True) -> None:
        """Full payment of the remaining debt (Z/T profiles)."""
        available = self.payable(agency_id)
        if available > 0:
            self.payment_then_post(
                moment, agency_id, available, self.rng.choice(["CASH", "BANK_TRANSFER"])
            )

    def terminate(self, moment: datetime, agency_id: int, reason: str) -> None:
        debt, _, _ = self.agency_state(agency_id)
        if Decimal(debt) != 0:
            raise SeedError(f"Agency {agency_id} still owes {debt} at termination")
        self.context(self.manager(), "agency.manage")
        self.s.execute(
            text(
                "UPDATE dms.agency SET status = 'TERMINATED', \"terminatedAt\" = dms.app_now(), "
                '"terminationReason" = :reason, "updatedBy" = :actor WHERE id = :id'
            ),
            {"reason": reason, "actor": self.manager(), "id": agency_id},
        )
        self.agencies[agency_id]["terminated"] = True

    def negative_start(self, moment: datetime, agency_id: int) -> None:
        if self.payable(agency_id) < data.NEGATIVE_ONLINE_AMOUNT:
            raise SeedError("Negative-debt agency has too little debt for its scripted payments")
        # The checkout is opened first; the owner then pays everything in cash at the
        # counter and the VNPAY success arrives afterwards (handoff 3.3).
        self.start_online(moment, agency_id, data.NEGATIVE_ONLINE_AMOUNT, "SUCCESS", delay=(33, 38))

    def deactivate(self, moment: datetime, key: str) -> None:
        self.context(self.user("giaphuc"), "product.manage")
        self.s.execute(
            text("UPDATE dms.product SET status = 'INACTIVE' WHERE id = :id"),
            {"id": self.products[key]},
        )

    def lock_user(self, moment: datetime, key: str) -> None:
        self.context(self.manager(), "users.manage")
        self.s.execute(
            text("UPDATE dms.app_user SET status = 'LOCKED' WHERE id = :id"), {"id": self.user(key)}
        )

    def clearance(self, moment: datetime, key: str) -> None:
        identifier = self.products[key]
        states = self.product_states()
        remaining = self.available(states, identifier)
        step = Decimal(str(self.product_spec[key][6][2]))
        price = rounded_amount(Decimal(states[identifier][1]), self.selling_rate())
        agencies = sorted(
            (r for r in self.issuable_agencies(moment.date()) if r["profile"] in ("N", "H")),
            key=lambda r: -float(Decimal(r["maxDebt"])),
        )
        for record in agencies:
            if remaining <= 0:
                break
            debt, max_debt, _ = self.agency_state(record["id"])
            room = (Decimal(max_debt) - Decimal(debt) - self.reserved_debt[record["id"]]) * Decimal(
                "0.9"
            )
            affordable = (room / price / step).to_integral_value(rounding="ROUND_FLOOR") * step
            quantity = min(remaining, affordable)
            if quantity <= 0:
                continue
            self.issue_with(
                moment, record, [(identifier, quantity, price)], "Bán thanh lý hàng tồn cuối vụ"
            )
            remaining -= quantity
            moment += timedelta(minutes=self.rng.randint(3, 9))

    def issue_with(self, moment: datetime, record: dict, lines, note=None) -> None:
        actor = self.salesperson(record, moment.date())
        identifier = self.documents("STOCK_ISSUE", actor).create(
            StockIssueInput(
                agencyId=str(record["id"]),
                businessDate=moment.date(),
                note=note,
                lines=[IssueLineInput(productId=str(i), quantity=q) for i, q, _ in lines],
            )
        )
        amount = sum((rounded_amount(q, p) for _, q, p in lines), Decimal(0))
        quantities = {i: q for i, q, _ in lines}
        self.reserved_debt[record["id"]] += amount
        for product, quantity in quantities.items():
            self.reserved_stock[product] += quantity
        self.pending[identifier] = ("STOCK_ISSUE", record["id"], amount, quantities)
        self.schedule(
            moment + timedelta(minutes=self.rng.randint(30, 70)),
            self.post,
            "STOCK_ISSUE",
            identifier,
        )

    def top_up(self, moment: datetime, agency_id: int) -> None:
        record = self.agencies[agency_id]
        debt, max_debt, _ = self.agency_state(agency_id)
        debt = Decimal(debt) + self.reserved_debt[agency_id]
        if debt >= Decimal(max_debt) * Decimal("0.92"):
            return
        target = Decimal(max_debt) * Decimal("0.95") - debt
        self.issue_for(moment, record, target=target, note="Đặt thêm hàng chuẩn bị cuối năm")

    # -------------------------------------------------------------- drafts ----

    def draft(self, moment: datetime, kind: str) -> None:
        day = moment.date()
        if kind == "STOCK_RECEIPT":
            group = self.rng.choice(["M", "U", "B", "E"])
            lines = []
            for key, spec in self.product_spec.items():
                if spec[3] == group and self.can_restock(key, day) and len(lines) < 4:
                    low, high, step = spec[6]
                    quantity = Decimal(str(max(Decimal(str(step)), Decimal(1)))) * self.rng.randint(
                        10, 30
                    )
                    lines.append(
                        ReceiptLineInput(
                            productId=str(self.products[key]),
                            quantity=quantity,
                            unitPrice=self.price_on(key, day),
                        )
                    )
            self.documents("STOCK_RECEIPT", self.warehouse()).create(
                StockReceiptInput(businessDate=day, note=data.RECEIPT_NOTES[group], lines=lines)
            )
        elif kind == "STOCK_ISSUE":
            candidates = [r for r in self.issuable_agencies(day) if r["profile"] == "N"]
            self.rng.shuffle(candidates)
            for record in candidates:
                debt, max_debt, _ = self.agency_state(record["id"])
                room = (
                    Decimal(max_debt) - Decimal(debt) - self.reserved_debt[record["id"]]
                ) * Decimal("0.8")
                lines = self.issue_lines(record, day, room)
                if lines:
                    self.documents("STOCK_ISSUE", self.salesperson(record, day)).create(
                        StockIssueInput(
                            agencyId=str(record["id"]),
                            businessDate=day,
                            lines=[
                                IssueLineInput(productId=str(i), quantity=q) for i, q, _ in lines
                            ],
                        )
                    )
                    amount = sum((rounded_amount(q, p) for _, q, p in lines), Decimal(0))
                    self.reserved_debt[record["id"]] += amount
                    for i, q, _ in lines:
                        self.reserved_stock[i] += q
                    break
        else:
            candidates = [
                r
                for r in self.agencies.values()
                if r["profile"] == "N"
                and r.get("id")
                and not r.get("terminated")
                and self.payable(r["id"]) >= 1_000_000
            ]
            record = self.rng.choice(candidates)
            amount = (self.payable(record["id"]) * Decimal("0.5") / 100_000).to_integral_value(
                rounding="ROUND_FLOOR"
            ) * 100_000
            self.create_payment(moment, record["id"], amount)
        self.stats[f"draft:{kind}"] += 1

    # ------------------------------------------------------------- planner ----

    def plan(self) -> None:
        records = self.prepare_agencies()
        early = sorted(
            (r for r in records if r["accepted"] < data.PRODUCTS_CREATED),
            key=lambda r: r["accepted"],
        )
        for record in early:
            moment = self.random_time(record["accepted"], (8, 30), (16, 0))
            self.set_clock(moment)
            self.insert_agency(moment, record)
        self.insert_units()
        self.insert_products()
        for record in records:
            if record["accepted"] >= data.PRODUCTS_CREATED:
                self.schedule(
                    self.random_time(record["accepted"], (8, 30), (11, 0)),
                    self.insert_agency,
                    record,
                )
        self.records = records
        self.schedule(
            at(data.DUYEN_JOINED, 8, 5), self.insert_user, self.duyen, self.user("thaonguyen")
        )

        days = self.business_days
        issue_days = defaultdict(int)
        by_month = defaultdict(list)
        for day in days:
            by_month[day.month].append(day)
        for month, count in data.MONTHLY_ISSUES.items():
            month_days = by_month.get(month, [])
            if not month_days:
                continue
            planned = count if month != 11 else round(count * min(1.0, len(month_days) / 11))
            weights = [0.6 if d == HISTORY_START else 1.0 for d in month_days]
            for day in self.rng.choices(month_days, weights, k=planned):
                issue_days[day] += 1
        self.issue_days = issue_days
        for day in days:
            self.schedule(at(day, 7, 30), self.plan_day)
        for key, created in data.LATE_PRODUCTS.items():
            if created <= self.end:
                self.schedule(at(created, 8, 15), self.insert_product, key)

    def plan_day(self, moment: datetime) -> None:
        day = moment.date()
        last = day == self.end
        # Receipts: opening stock on the first day, then the most urgent supplier groups.
        groups = sorted({spec[3] for spec in self.product_spec.values()})
        if day == HISTORY_START:
            for group in groups:
                self.schedule(
                    self.random_time(day, (7, 40), (9, 0)), self.create_receipt, group, True
                )
        else:
            urgent = sorted(
                ((self.needs_reorder(group, day), group) for group in groups), reverse=True
            )
            picks = [u for u in urgent if u[0] > 0]
            for _urgency, group in picks[: 2 if len(picks) > 1 and picks[1][0] > 2 else 1]:
                self.schedule(self.random_time(day, (7, 45), (10, 30)), self.create_receipt, group)
        # Issues of the day.
        start = (10, 0) if day == HISTORY_START else (8, 0)
        for _ in range(self.issue_days.get(day, 0)):
            self.schedule(self.random_time(day, start, (15, 45)), self.create_issue)
        # Ordinary payments.
        for record in self.agencies.values():
            identifier = record["id"]
            if record.get("terminated") or day >= self.payments_closed_from.get(
                identifier, date.max
            ):
                continue
            debt, max_debt, _ = self.agency_state(identifier)
            if Decimal(debt) <= 0:
                continue
            ratio = float(Decimal(debt) / Decimal(max_debt))
            if self.rng.random() < self.payment_probability(record, day, ratio):
                self.schedule(
                    self.random_time(day, (8, 0), (16, 0)), self.payment_then_post, identifier
                )
        # VNPAY checkouts.
        for planned_day, outcome in data.ONLINE_PLAN:
            if planned_day == day:
                self.schedule(
                    self.random_time(day, (8, 30), (15, 30)), self.planned_online, outcome
                )
        # Manager corrections and cancellations.
        for planned_day, action, reason in data.SPECIALS:
            if planned_day == day:
                hour = (
                    (9, 30)
                    if action.startswith(
                        ("duplicate", "wrong", "cancel_transfer", "cancel_receipt")
                    )
                    else (14, 30)
                )
                self.schedule(
                    self.random_time(day, hour, (hour[0], 59)), self.special, action, reason
                )
        self.plan_endings(day, last)

    def plan_endings(self, day: date, last: bool) -> None:
        for record in self.agencies.values():
            identifier, profile = record["id"], record["profile"]
            if day >= record.get("close_issues", date.max):
                self.closed_from.setdefault(identifier, day)
            if day >= record.get("close_payments", date.max):
                self.payments_closed_from.setdefault(identifier, day)
            if day == record.get("settle"):
                if profile == "X":
                    self.schedule(at(day, 9, 5, 12), self.negative_start, identifier)
                    self.schedule(at(day, 9, 20, 40), self.negative_cash, identifier)
                else:
                    self.schedule(at(day, 14, 10, self.rng.randrange(60)), self.settle, identifier)
            if profile == "T" and day == data.TERMINATIONS[record["name"]][0]:
                reason = data.TERMINATIONS[record["name"]][1]
                self.schedule(
                    at(day, 10, 5, self.rng.randrange(60)), self.terminate, identifier, reason
                )
            if profile == "H" and last:
                self.schedule(at(day, 13, self.rng.randint(0, 40)), self.top_up, identifier)
        for key, (_, clearance, inactive) in data.DISCONTINUED.items():
            if day == clearance:
                self.schedule(at(day, 10, 30), self.clearance, key)
            if day == inactive:
                self.schedule(at(day, 7, 50), self.deactivate, key)
        if day == data.LUC_LOCKED:
            self.schedule(at(day, 16, 45), self.lock_user, "vanluc")
        # Drafts of the current week (handoff 6.5), awaiting posting.
        week_start = self.today - timedelta(days=self.today.weekday())
        draft_days = [d for d in self.business_days if d >= week_start] or self.business_days[-1:]
        if day in draft_days:
            index = draft_days.index(day)
            kinds = [
                "STOCK_ISSUE",
                "PAYMENT_RECEIPT",
                "STOCK_RECEIPT",
                "STOCK_ISSUE",
                "PAYMENT_RECEIPT",
                "STOCK_ISSUE",
                "STOCK_RECEIPT",
                "STOCK_ISSUE",
            ]
            share = [k for i, k in enumerate(kinds) if i % len(draft_days) == index]
            for kind in share:
                self.schedule(self.random_time(day, (15, 50), (16, 50)), self.draft, kind)

    def negative_cash(self, moment: datetime, agency_id: int) -> None:
        debt, _, _ = self.agency_state(agency_id)
        # The pending checkout reserved part of the debt; the counter payment settles the
        # whole recorded debt, which QĐ4 allows.
        self.reserved_pay[agency_id] -= data.NEGATIVE_ONLINE_AMOUNT
        identifier = self.create_payment(
            moment, agency_id, Decimal(debt), "CASH", "Chủ cửa hàng trả hết nợ bằng tiền mặt"
        )
        self.reserved_pay[agency_id] += data.NEGATIVE_ONLINE_AMOUNT
        if identifier is None:
            raise SeedError("Negative-debt cash payment could not be prepared")
        self.schedule(
            moment + timedelta(minutes=4, seconds=20), self.post, "PAYMENT_RECEIPT", identifier
        )


def seeded(connection) -> bool:
    return bool(connection.execute(text("SELECT EXISTS (SELECT 1 FROM dms.app_user)")).scalar_one())


def seed(session: Session, today: date) -> Counter:
    session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": LOCK_KEY})
    empty = session.execute(
        text(
            "SELECT NOT EXISTS (SELECT 1 FROM dms.app_user) AND NOT EXISTS (SELECT 1 FROM "
            "dms.agency) "
            "AND NOT EXISTS (SELECT 1 FROM dms.product) AND NOT EXISTS (SELECT 1 FROM "
            "dms.document) "
            "AND NOT EXISTS (SELECT 1 FROM dms.unit)"
        )
    ).scalar_one()
    if not empty:
        raise SeedError("Seed v2 requires an empty migrated 0011 schema")
    seeder = Seeder(session, today)
    seeder.seed_users()
    seeder.seed_catalogue()
    seeder.plan()
    seeder.run()
    session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
    session.execute(text("SELECT set_config('dms.clock', '', true)"))
    return seeder.stats


def require_head(connection) -> None:
    version = connection.execute(
        text("SELECT version_num FROM public.alembic_version")
    ).scalar_one_or_none()
    if version != COMPATIBLE_HEAD:
        raise SeedError(f"Run alembic upgrade head before seeding (expected {COMPATIBLE_HEAD})")


def main() -> None:
    engine = build_engine(get_settings().database_url())
    try:
        with engine.connect() as connection:
            require_head(connection)
            if seeded(connection):
                counts = check_database(connection, seeded=True)
                connection.rollback()
                print("Seed v2 already present; verification only.")
                for name, count in counts.items():
                    print(f"{name}: {count}")
                return
        today = datetime.now(VN).date()
        with Session(engine) as session, session.begin():
            stats = seed(session, today)
            counts = check_database(session.connection(), seeded=True)
        for name, value in sorted(stats.items()):
            print(f"{name}: {value}")
        for name, count in counts.items():
            print(f"{name}: {count}")
        print("PASS: seed v2 committed and verified")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
