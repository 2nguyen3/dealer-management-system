"""Live PostgreSQL integrity checks of the simplified 0011 schema (handoff 4/6.6).

``--seeded`` adds the seed v2 checks: account hashes, volumes and situations,
chronological replay (stock never negative, QĐ3 at posting time), report closing debt,
the forbidden-word scan and business-hour windows. ``--regression`` runs the SQL
regression in an isolated, always rolled-back schema built from the 0011 snapshot.
"""

import argparse
import re
import unicodedata
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from uuid import uuid4

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import build_engine

EXPECTED_TABLES = {
    "user_group",
    "app_function",
    "app_user",
    "group_permission",
    "auth_token",
    "business_rule",
    "ward",
    "agency_type",
    "unit",
    "agency",
    "product",
    "document",
    "document_line",
    "online_payment",
    "payment_event",
    "audit_log",
}
VN = timezone(timedelta(hours=7))
HISTORY_START = date(2026, 6, 1)
HOLIDAYS = {date(2026, 9, 1), date(2026, 9, 2)}
OPEN, CLOSE = time(7, 30), time(17, 30)

# Accented forms match exactly; ASCII forms also match the accent-stripped text. The
# unaccented single syllables "mau"/"thu" are not scanned: they collide with ordinary
# words such as "màu" and the given name "Thu" (recorded in the simplification VERIFICATION).
FORBIDDEN_ACCENTED = re.compile(r"(?<!\w)(mẫu|thử|ngừng bán|sắp mở bán)(?!\w)")
FORBIDDEN_ASCII = re.compile(
    r"(?<![a-z0-9])(demo|test|sample|fake|ngung ban|sap mo ban)(?![a-z0-9])"
)
TEXT_EXCLUDED = {("app_user", "passwordHash")}

INTEGRITY_CHECKS = {
    "timestamps": None,  # generated per table
    "agency debt = posted issues - posted receipts": """
        SELECT count(*) FROM dms.agency a WHERE a.debt <> coalesce((
          SELECT sum(CASE WHEN d.kind = 'STOCK_ISSUE' THEN d."totalAmount" ELSE
            -d."totalAmount" END)
          FROM dms.document d WHERE d."agencyId" = a.id AND d.status = 'POSTED'), 0)""",
    "product stock = posted receipts - posted issues": """
        SELECT count(*) FROM dms.product p WHERE p.stock <> coalesce((
          SELECT sum(CASE WHEN d.kind = 'STOCK_RECEIPT' THEN l.quantity ELSE -l.quantity END)
          FROM dms.document_line l JOIN dms.document d ON d.id = l."documentId"
          WHERE l."productId" = p.id AND d.status = 'POSTED'), 0)""",
    "last purchase price = latest posted receipt line": """
        SELECT count(*) FROM dms.product p WHERE p."lastPurchasePrice" IS DISTINCT FROM (
          SELECT l."unitPrice" FROM dms.document_line l JOIN dms.document d ON d.id = l."documentId"
          WHERE l."productId" = p.id AND d.kind = 'STOCK_RECEIPT' AND d.status = 'POSTED'
          ORDER BY d."postedAt" DESC, d.id DESC LIMIT 1)""",
    "goods document total = line amounts": """
        SELECT count(*) FROM dms.document d WHERE d.kind <> 'PAYMENT_RECEIPT' AND d.status <>
          'DRAFT'
          AND d."totalAmount" <> (SELECT coalesce(sum("lineAmount"), 0)
            FROM dms.document_line WHERE "documentId" = d.id)""",
    "posted issues record their selling-price rate": """
        SELECT count(*) FROM dms.document d JOIN dms.document_line l ON l."documentId" = d.id
        WHERE d.kind = 'STOCK_ISSUE' AND d.status <> 'DRAFT' AND d."sellingPriceRate" IS NULL""",
    "replacement points to a cancelled document of the same kind/agency": """
        SELECT count(*) FROM dms.document n JOIN dms.document o ON o.id = n."replacesDocumentId"
        WHERE o.status <> 'CANCELLED' OR o.kind <> n.kind
          OR o."agencyId" IS DISTINCT FROM n."agencyId" OR n.status = 'DRAFT'""",
    "successful online payment has its posted ONLINE receipt": """
        SELECT count(*) FROM dms.online_payment p LEFT JOIN dms.document d ON d.id =
          p."receiptDocumentId"
        WHERE (p.status = 'SUCCESS') <> (d.id IS NOT NULL AND d.status = 'POSTED'
          AND d."receiptType" = 'ONLINE' AND d."totalAmount" = p.amount AND d."agencyId" =
            p."agencyId")""",
    "ONLINE receipts belong to an online payment": """
        SELECT count(*) FROM dms.document d WHERE d."receiptType" = 'ONLINE'
          AND NOT EXISTS (SELECT 1 FROM dms.online_payment p WHERE p."receiptDocumentId" = d.id)""",
    "active agencies per ward within the rule": """
        SELECT count(*) FROM (SELECT "wardId" FROM dms.agency WHERE status = 'ACTIVE'
          GROUP BY "wardId" HAVING count(*) > (SELECT "maxAgenciesPerWard" FROM
            dms.business_rule)) x""",
    "no negative stock": "SELECT count(*) FROM dms.product WHERE stock < 0",
    "audit snapshots never contain secrets": """
        SELECT count(*) FROM dms.audit_log WHERE coalesce("oldData", '{}') ?|
          array['passwordHash','tokenDigest']
          OR coalesce("newData", '{}') ?| array['passwordHash','tokenDigest']""",
    "168 HCMC wards": "SELECT abs(count(*) - 168) FROM dms.ward",
    "22 application functions": "SELECT abs(count(*) - 22) FROM dms.app_function",
}


def scalar(connection, sql, params=None):
    return connection.execute(text(sql), params or {}).scalar_one()


def check_database(connection, *, seeded: bool = False) -> dict[str, int]:
    tables = set(
        connection.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'dms'")
        ).scalars()
    )
    if tables != EXPECTED_TABLES:
        raise RuntimeError(
            f"Unexpected dms tables: missing {sorted(EXPECTED_TABLES - tables)}, "
            f"extra {sorted(tables - EXPECTED_TABLES)}"
        )
    counts = {
        table: scalar(connection, f'SELECT count(*) FROM dms."{table}"')
        for table in sorted(EXPECTED_TABLES)
    }
    for table in sorted(EXPECTED_TABLES):
        bad = scalar(
            connection, f'SELECT count(*) FROM dms."{table}" WHERE "createdAt" > "updatedAt"'
        )
        if bad:
            raise RuntimeError(f"FAIL timestamps of {table}: {bad} rows")
    for label, sql in INTEGRITY_CHECKS.items():
        if sql is None:
            continue
        bad = scalar(connection, sql)
        if bad:
            raise RuntimeError(f"FAIL {label}: {bad}")
    if seeded:
        check_seeded(connection)
    return counts


# ------------------------------------------------------------------ seeded ----


def require(condition: bool, label: str) -> None:
    if not condition:
        raise RuntimeError(f"FAIL seeded: {label}")


def check_seeded(connection) -> None:
    from app.db import seed_data as data  # local import: seed_data is seed-only

    check_accounts(connection, data)
    check_volumes(connection)
    check_situations(connection, data)
    replay(connection)
    check_report_closing(connection)
    scan_forbidden_words(connection)
    check_time_windows(connection)
    check_contacts(connection)


def check_accounts(connection, data) -> None:
    hasher = PasswordHasher()
    users = {
        row.email: row
        for row in connection.execute(
            text(
                'SELECT u.email, u."passwordHash", u.status, u."fullName", g.code AS "group" '
                'FROM dms.app_user u JOIN dms.user_group g ON g.id = u."groupId"'
            )
        )
    }
    require(len(users) == len(data.USERS), f"{len(data.USERS)} accounts")
    for email, name, group, password, status in data.USERS:
        user = users.get(email)
        require(user is not None, f"account {email}")
        require(
            (user.fullName, user.group, user.status) == (name, group, status), f"{email} profile"
        )
        try:
            hasher.verify(user.passwordHash, password)
        except VerificationError:
            raise RuntimeError(f"FAIL seeded: password of {email}") from None
        require(user.passwordHash.startswith("$argon2id$"), f"{email} uses Argon2id")


def check_volumes(connection) -> None:
    rows = connection.execute(
        text(
            "SELECT kind, count(*) FILTER (WHERE status <> 'DRAFT') AS recorded, "
            "count(*) FILTER (WHERE status = 'DRAFT') AS drafts FROM dms.document GROUP BY kind"
        )
    ).all()
    volume = {row.kind: row.recorded for row in rows}
    drafts = sum(row.drafts for row in rows)
    require(80 <= volume.get("STOCK_RECEIPT", 0) <= 100, f"80-100 receipts, got {volume}")
    require(230 <= volume.get("STOCK_ISSUE", 0) <= 260, f"230-260 issues, got {volume}")
    require(110 <= volume.get("PAYMENT_RECEIPT", 0) <= 140, f"110-140 payments, got {volume}")
    require(6 <= drafts <= 10, f"6-10 drafts, got {drafts}")
    draft_kinds = scalar(
        connection, "SELECT count(DISTINCT kind) FROM dms.document WHERE status='DRAFT'"
    )
    require(draft_kinds == 3, "drafts of all three kinds")
    online = dict(
        connection.execute(
            text("SELECT status, count(*) FROM dms.online_payment GROUP BY status")
        ).all()
    )
    require(15 <= sum(online.values()) <= 25, f"15-25 VNPAY payments, got {online}")
    require("PENDING" not in online, "no PENDING VNPAY payment")
    require(all(online.get(s, 0) > 0 for s in ("SUCCESS", "FAILED", "EXPIRED")), "VNPAY outcomes")
    require(
        scalar(
            connection,
            "SELECT count(*) FROM dms.payment_event e JOIN dms.online_payment p "
            'ON p.id = e."paymentId" WHERE e."eventKey" !~ \'^vnpay:[0-9a-f]{64}$\' '
            "OR p.\"merchantReference\" !~ '^VNP[0-9a-f]{32}$'",
        )
        == 0,
        "VNPAY reference and event formats",
    )
    receipt_types = set(
        connection.execute(
            text(
                "SELECT DISTINCT \"receiptType\" FROM dms.document WHERE status = 'POSTED' "
                "AND kind = 'PAYMENT_RECEIPT'"
            )
        ).scalars()
    )
    require(
        receipt_types == {"CASH", "BANK_TRANSFER", "ONLINE"}, "cash, transfer and online receipts"
    )
    months = connection.execute(
        text(
            "SELECT date_trunc('month', \"businessDate\")::date AS month, kind, count(*) "
            "FROM dms.document WHERE status = 'POSTED' GROUP BY 1, 2"
        )
    ).all()
    seen = {(row.month, row.kind) for row in months}
    today = datetime.now(VN).date()
    month = HISTORY_START
    while month <= today.replace(day=1):
        for kind in ("STOCK_ISSUE", "PAYMENT_RECEIPT"):
            require((month, kind) in seen, f"posted {kind} in {month:%m/%Y}")
        month = (month + timedelta(days=32)).replace(day=1)


def check_situations(connection, data) -> None:
    def count(sql):
        return scalar(connection, sql)

    cancelled_only = """SELECT count(*) FROM dms.document d WHERE d.kind = :kind AND
      d.status='CANCELLED'
        AND NOT EXISTS (SELECT 1 FROM dms.document n WHERE n."replacesDocumentId" = d.id)"""
    corrected = """SELECT count(*) FROM dms.document WHERE kind = :kind AND
      "replacesDocumentId" IS NOT NULL"""
    ranges = {
        "STOCK_RECEIPT": ((1, 2), (1, 2)),
        "STOCK_ISSUE": ((3, 5), (3, 5)),
        "PAYMENT_RECEIPT": ((1, 2), (0, 0)),
    }
    for kind, ((low, high), (fix_low, fix_high)) in ranges.items():
        value = scalar(connection, cancelled_only, {"kind": kind})
        require(low <= value <= high, f"{low}-{high} cancelled {kind}, got {value}")
        value = scalar(connection, corrected, {"kind": kind})
        require(fix_low <= value <= fix_high, f"{fix_low}-{fix_high} corrected {kind}, got {value}")
    require(count("SELECT count(*) FROM dms.agency") >= 30, ">= 30 agencies")
    require(count("SELECT count(*) FROM dms.agency WHERE status='TERMINATED'") == 2, "2 terminated")
    require(
        count(
            "SELECT count(*) FROM dms.agency a WHERE a.status='TERMINATED' AND NOT EXISTS "
            '(SELECT 1 FROM dms.document d WHERE d."agencyId" = a.id)'
        )
        == 0,
        "terminated agencies have history",
    )
    fresh = count(
        "SELECT count(*) FROM dms.agency a WHERE NOT EXISTS (SELECT 1 FROM dms.document d "
        "WHERE d.\"agencyId\" = a.id AND d.status <> 'DRAFT') AND NOT EXISTS "
        '(SELECT 1 FROM dms.online_payment p WHERE p."agencyId" = a.id)'
    )
    require(2 <= fresh <= 3, f"2-3 agencies without transactions, got {fresh}")
    high = count(
        'SELECT count(*) FROM dms.agency a JOIN dms.agency_type t ON t.id = a."typeId" '
        "WHERE a.status = 'ACTIVE' AND a.debt >= 0.9 * t.\"maxDebt\""
    )
    require(high >= 2, f"agencies at >= 90% of the limit, got {high}")
    zero = count(
        "SELECT count(*) FROM dms.agency a WHERE a.debt = 0 AND a.status = 'ACTIVE' AND EXISTS "
        "(SELECT 1 FROM dms.document d WHERE d.\"agencyId\" = a.id AND d.status = 'POSTED')"
    )
    require(zero >= 2, f"agencies with history and zero debt, got {zero}")
    require(count("SELECT count(*) FROM dms.agency WHERE debt < 0") >= 1, "a negative-debt agency")
    require(
        count(
            "SELECT count(*) FROM (SELECT \"wardId\" FROM dms.agency WHERE status='ACTIVE' GROUP "
            "BY 1 "
            'HAVING count(*) = (SELECT "maxAgenciesPerWard" FROM dms.business_rule)) x'
        )
        >= 1,
        "a ward at full capacity",
    )
    require(
        count(
            "SELECT count(*) FROM (SELECT name FROM dms.agency GROUP BY name "
            'HAVING count(DISTINCT "wardId") > 1) x'
        )
        >= 1,
        "a duplicate agency name in two wards",
    )
    emails = count("SELECT count(*) FROM dms.agency WHERE email IS NOT NULL")
    total = count("SELECT count(*) FROM dms.agency")
    require(0.25 <= emails / total <= 0.45, "about one third of agencies have an email")
    require(count('SELECT count(DISTINCT "wardId") FROM dms.agency') >= 18, "about 20 wards")
    inactive = count(
        "SELECT count(*) FROM dms.product p WHERE status = 'INACTIVE' AND EXISTS "
        '(SELECT 1 FROM dms.document_line l WHERE l."productId" = p.id)'
    )
    require(1 <= inactive <= 2, f"1-2 inactive products with history, got {inactive}")
    require(
        count(
            'SELECT count(*) FROM dms.product WHERE "lastPurchasePrice" IS NULL AND '
            "status='ACTIVE'"
        )
        >= 1,
        "a product never received",
    )
    require(count("SELECT count(*) FROM dms.product") >= 24, ">= 24 products")
    raised = count(
        'SELECT count(*) FROM (SELECT l."productId" FROM dms.document_line l JOIN dms.document d '
        "ON d.id = l.\"documentId\" WHERE d.kind='STOCK_RECEIPT' AND d.status='POSTED' "
        'GROUP BY 1 HAVING count(DISTINCT l."unitPrice") > 1) x'
    )
    require(raised >= 3, f"purchase price changes for >= 3 products, got {raised}")
    require(
        count('SELECT count(*) FROM dms.unit WHERE "allowsFraction"') >= 2
        and count("SELECT count(*) FROM dms.document_line WHERE quantity <> trunc(quantity)") >= 1,
        "fractional units in use",
    )
    locked = count(
        "SELECT count(*) FROM dms.app_user u WHERE u.status = 'LOCKED' AND EXISTS "
        '(SELECT 1 FROM dms.document d WHERE d."createdBy" = u.id)'
    )
    require(locked == 1, "one locked account with history")
    roles = connection.execute(
        text(
            "SELECT d.kind, g.code AS creator, pg.code AS poster FROM dms.document d "
            'LEFT JOIN dms.app_user c ON c.id = d."createdBy" LEFT JOIN dms.user_group g ON g.id '
            '= c."groupId" '
            'LEFT JOIN dms.app_user p ON p.id = d."postedBy" LEFT JOIN dms.user_group pg ON '
            'pg.id = p."groupId" '
            'WHERE d."replacesDocumentId" IS NULL GROUP BY 1, 2, 3'
        )
    ).all()
    allowed = {
        "STOCK_RECEIPT": ({"WAREHOUSE"}, {"WAREHOUSE", None}),
        "STOCK_ISSUE": ({"SALES"}, {"WAREHOUSE", None}),
        "PAYMENT_RECEIPT": ({"ACCOUNTING"}, {"ACCOUNTING", None}),
    }
    for row in roles:
        creators, posters = allowed[row.kind]
        require(row.creator in creators and row.poster in posters, f"roles of {row.kind}: {row}")
    managers = (
        connection.execute(
            text(
                "SELECT DISTINCT g.code FROM dms.document d JOIN dms.app_user u ON u.id = "
                'd."cancelledBy" '
                'JOIN dms.user_group g ON g.id = u."groupId"'
            )
        )
        .scalars()
        .all()
    )
    require(set(managers) == {"MANAGEMENT"}, "only the manager cancels or corrects")


def replay(connection) -> None:
    """Replay postings/cancellations in time order: stock >= 0 and QĐ3 at each issue post."""
    limits = dict(
        connection.execute(
            text(
                'SELECT a.id, t."maxDebt" FROM dms.agency a JOIN dms.agency_type t ON t.id = '
                'a."typeId"'
            )
        ).all()
    )
    documents = connection.execute(
        text(
            'SELECT id, kind, "agencyId", "totalAmount", status, "postedAt", "cancelledAt", '
            "\"sellingPriceRate\" FROM dms.document WHERE status <> 'DRAFT'"
        )
    ).all()
    lines = defaultdict(list)
    for row in connection.execute(
        text(
            'SELECT l."documentId", l."productId", l.quantity, l."unitPrice" FROM '
            "dms.document_line l "
            "JOIN dms.document d ON d.id = l.\"documentId\" WHERE d.status <> 'DRAFT'"
        )
    ):
        lines[row.documentId].append((row.productId, Decimal(row.quantity), Decimal(row.unitPrice)))
    events = []
    for document in documents:
        # Same instant (a correction): receipts add the new stock first, issues and
        # payments release the old effect first, exactly like DocumentService.correct.
        post_order = 0 if document.kind == "STOCK_RECEIPT" else 2
        events.append((document.postedAt, post_order, document.id, "post", document))
        if document.status == "CANCELLED":
            events.append((document.cancelledAt, 1, document.id, "cancel", document))
    events.sort(key=lambda event: event[:3])
    stock = defaultdict(Decimal)
    debt = defaultdict(Decimal)
    receipts = defaultdict(list)  # product -> posted receipt prices in posting order
    for _, _, _, action, document in events:
        sign = 1 if action == "post" else -1
        if document.kind == "STOCK_RECEIPT":
            for product, _quantity, price in lines[document.id]:
                if action == "post":
                    receipts[product].append((document.id, price))
                else:
                    receipts[product].remove((document.id, price))
        elif document.kind == "STOCK_ISSUE" and action == "post":
            for product, _quantity, price in lines[document.id]:
                require(
                    receipts[product], f"QĐ2 product {product} priced at document {document.id}"
                )
                expected = (receipts[product][-1][1] * Decimal(document.sellingPriceRate)).quantize(
                    Decimal(1), rounding=ROUND_HALF_UP
                )
                require(price == expected, f"QĐ2 selling price of document {document.id}")
        if document.kind == "PAYMENT_RECEIPT":
            debt[document.agencyId] -= sign * Decimal(document.totalAmount)
            continue
        direction = 1 if document.kind == "STOCK_RECEIPT" else -1
        for product, quantity, _price in lines[document.id]:
            stock[product] += sign * direction * quantity
            require(stock[product] >= 0, f"stock of product {product} negative at {document.id}")
        if document.kind == "STOCK_ISSUE":
            debt[document.agencyId] += sign * Decimal(document.totalAmount)
            if action == "post":
                require(
                    debt[document.agencyId] <= Decimal(limits[document.agencyId]),
                    f"QĐ3 at posting of document {document.id}",
                )


def check_report_closing(connection) -> None:
    from app.modules.reports.repository import ReportQueries

    today = datetime.now(VN).date()
    first = today.replace(day=1)
    after = (first + timedelta(days=32)).replace(day=1)
    report = ReportQueries(connection).read("debt", first, after)
    closing = {int(row["agencyId"]): Decimal(row["closingDebt"]) for row in report["rows"]}
    for identifier, debt in connection.execute(text("SELECT id, debt FROM dms.agency")).all():
        require(
            closing.get(identifier, Decimal(0)) == Decimal(debt),
            f"closing debt of agency {identifier}",
        )


def strip_accents(value: str) -> str:
    value = value.replace("đ", "d").replace("Đ", "D")
    return "".join(
        c for c in unicodedata.normalize("NFD", value) if unicodedata.category(c) != "Mn"
    )


def scan_forbidden_words(connection) -> None:
    columns = connection.execute(
        text(
            "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = "
            "'dms' "
            "AND data_type IN ('text', 'character varying', 'jsonb', 'json') ORDER BY 1, 2"
        )
    ).all()
    for table, column in columns:
        if (table, column) in TEXT_EXCLUDED:
            continue
        values = connection.execute(
            text(
                f'SELECT DISTINCT "{column}"::text FROM dms."{table}" WHERE "{column}" IS NOT NULL'
            )
        ).scalars()
        for value in values:
            lowered = unicodedata.normalize("NFC", value).lower()
            plain = strip_accents(lowered)
            match = FORBIDDEN_ACCENTED.search(lowered) or FORBIDDEN_ASCII.search(plain)
            require(
                match is None, f"forbidden word {match and match.group(0)!r} in {table}.{column}"
            )


def check_time_windows(connection) -> None:
    today = datetime.now(VN).date()
    rows = connection.execute(
        text(
            "SELECT 'document' AS source, id, \"createdAt\" AS moment FROM dms.document "
            'UNION ALL SELECT \'document\', id, "postedAt" FROM dms.document WHERE "postedAt" IS '
            "NOT NULL "
            "UNION ALL SELECT 'document', id, \"cancelledAt\" FROM dms.document WHERE "
            '"cancelledAt" IS NOT NULL '
            "UNION ALL SELECT 'online_payment', id, \"createdAt\" FROM dms.online_payment"
        )
    ).all()
    for row in rows:
        local = row.moment.astimezone(VN)
        require(
            HISTORY_START <= local.date() <= today
            and local.date() not in HOLIDAYS
            and OPEN <= local.time() <= CLOSE,
            f"{row.source} {row.id} outside business hours: {local}",
        )
    late = scalar(
        connection,
        'SELECT count(*) FROM dms.document WHERE "postedAt" IS NOT NULL AND ("postedAt" < '
        '"createdAt" '
        'OR "postedAt" > "createdAt" + interval \'3 days\')',
    )
    require(late == 0, "postedAt within 0-2 days after createdAt")
    before = scalar(
        connection, f"SELECT count(*) FROM dms.document WHERE \"businessDate\" < '{HISTORY_START}'"
    )
    require(before == 0, "no document before 01/06/2026")


def check_contacts(connection) -> None:
    phones = connection.execute(text("SELECT phone FROM dms.agency ORDER BY id")).scalars().all()
    require(
        all(p and re.fullmatch(r"0[35789][0-9]{8}", p) for p in phones), "Vietnamese mobile numbers"
    )
    require(len(set(phones)) == len(phones), "unique phone numbers")
    require(phones != sorted(phones), "phone numbers are not sequential")
    wrong = scalar(
        connection,
        'SELECT count(*) FROM dms.agency a JOIN dms.ward w ON w.id = a."wardId" '
        "WHERE position(w.name IN coalesce(a.address, '')) = 0",
    )
    require(wrong == 0, "every address names its ward")


# -------------------------------------------------------------- regression ----


def run_regression(connection) -> int:
    """Run regression.sql against a fresh 0011 schema renamed to an isolated name."""
    schema = f"dms_verify_{uuid4().hex}"
    sql = Path(__file__).parents[2] / "alembic" / "sql"
    with connection.connection.driver_connection.cursor() as cursor:
        for script in (
            (sql / "0011_simplified_schema.sql").read_text(encoding="utf-8"),
            (Path(__file__).parent / "sql" / "regression.sql").read_text(encoding="utf-8"),
        ):
            cursor.execute(re.sub(r"\bdms\b", schema, script), prepare=False)
    return connection.exec_driver_sql(
        f"SELECT current_setting('{schema}.test_passes')::integer"
    ).scalar_one()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--regression", action="store_true")
    parser.add_argument("--seeded", action="store_true")
    args = parser.parse_args()
    engine = build_engine(get_settings().database_url())
    try:
        with engine.connect() as connection:
            counts = check_database(connection, seeded=args.seeded)
            for name, count in counts.items():
                print(f"{name}: {count}")
            print(
                f"PASS: {len(counts)} tables, timestamps, debt/stock/price/total, "
                "replacement, online payment and capacity integrity"
                + (", seed v2 checks" if args.seeded else "")
            )
            connection.rollback()
            if args.regression:
                transaction = connection.begin()
                try:
                    checks = run_regression(connection)
                    print(f"PASS: {checks} 0011 PostgreSQL regression assertions/rejections")
                finally:
                    transaction.rollback()
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
