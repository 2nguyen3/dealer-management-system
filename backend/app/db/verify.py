"""Live PostgreSQL integrity checks; optional regression fixtures always roll back."""

import argparse
import re
from pathlib import Path
from uuid import uuid4

from argon2 import PasswordHasher
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
    "district",
    "agency_type",
    "unit",
    "agency",
    "agency_balance",
    "product",
    "inventory_balance",
    "document",
    "document_revision",
    "document_line",
    "upfront_confirmation",
    "online_payment",
    "payment_event",
    "posting_batch",
    "inventory_entry",
    "receivable_entry",
    "credit_lot",
    "credit_entry",
    "refund_reservation",
    "refund_attempt",
    "stock_count",
    "stock_count_line",
    "audit_log",
}


def check_database(connection, *, seeded: bool = False) -> dict[str, int]:
    tables = set(
        connection.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'dms'")
        ).scalars()
    )
    if tables != EXPECTED_TABLES:
        raise RuntimeError(f"Unexpected DMS tables: {tables ^ EXPECTED_TABLES}")
    counts = {
        name: connection.exec_driver_sql(f'SELECT count(*) FROM dms."{name}"').scalar_one()
        for name in sorted(tables)
    }
    timestamp_count = connection.exec_driver_sql("""
        SELECT count(*) FROM information_schema.columns
        WHERE table_schema='dms' AND table_name IN
          (SELECT tablename FROM pg_tables WHERE schemaname='dms')
          AND column_name IN ('createdAt','updatedAt') AND is_nullable='NO'
          AND data_type='timestamp with time zone'
    """).scalar_one()
    if timestamp_count != 58:
        raise RuntimeError("All 29 tables must have two required timestamptz columns")
    # assert_document is read-only; assert_agency/product update caches and are
    # deliberately not invoked directly, outside their deferred trigger context.
    connection.exec_driver_sql("SELECT dms.assert_document(id) FROM dms.document")
    connection.exec_driver_sql("SELECT dms.assert_online_payment(id) FROM dms.online_payment")
    connection.exec_driver_sql("SELECT dms.assert_upfront(id) FROM dms.upfront_confirmation")
    connection.exec_driver_sql("""
        SELECT dms.assert_refund("refundRevisionId") FROM dms.refund_reservation
    """)
    failures = connection.exec_driver_sql("""
        SELECT
          (SELECT count(*) FROM dms.inventory_balance b WHERE "currentStock" < 0
            OR "currentStock" <> coalesce((SELECT sum(quantity) FROM dms.inventory_entry e
              WHERE e."productId"=b."productId"),0))
          + (SELECT count(*) FROM dms.agency_balance b WHERE "currentDebt" < 0
            OR "currentCredit" < 0 OR "currentDebt" <> coalesce(
              (SELECT sum(amount) FROM dms.receivable_entry e WHERE e."agencyId"=b."agencyId"),0)
            OR "currentCredit" <> coalesce(
              (SELECT sum(amount) FROM dms.credit_entry e WHERE e."agencyId"=b."agencyId"),0))
          + (SELECT count(*) FROM dms.credit_availability WHERE available < 0)
          + (SELECT count(*) FROM dms.audit_log WHERE "newData" ? 'passwordHash'
            OR "oldData" ? 'passwordHash' OR "newData" ? 'tokenDigest'
            OR "oldData" ? 'tokenDigest')
    """).scalar_one()
    if failures:
        raise RuntimeError(f"Ledger/cache/audit reconciliation failed: {failures}")
    connection.exec_driver_sql("""
        SELECT * FROM dms.sales_report('2026-06-01','2026-10-01')
    """).all()
    debt = (
        connection.exec_driver_sql("""
        SELECT * FROM dms.debt_report('2026-01-01','2027-01-01')
    """)
        .mappings()
        .all()
    )
    for row in debt:
        actual = connection.execute(
            text("""
            SELECT "currentDebt" FROM dms.agency_balance WHERE "agencyId"=:id
        """),
            {"id": row["agencyId"]},
        ).scalar_one()
        if actual != row["closingDebt"]:
            raise RuntimeError("Debt report does not reconcile to current balances")
    if seeded:
        if any(value == 0 for value in counts.values()):
            raise RuntimeError("The full demo must populate every DMS table")
        from app.db.seed import DEMO_USERS

        hasher = PasswordHasher()
        for email, _, _, password, status in DEMO_USERS:
            user = (
                connection.execute(
                    text("""
                SELECT "passwordHash",status FROM dms.app_user WHERE email=:email
            """),
                    {"email": email},
                )
                .mappings()
                .one()
            )
            if not hasher.verify(user["passwordHash"], password) or user["status"] != status:
                raise RuntimeError(f"Invalid demo account: {email}")
    return counts


def run_regression(connection) -> int:
    # The suite changes global limits and report totals. Execute in an isolated
    # transactional schema so a populated database is never part of its fixtures.
    schema = f"dms_verify_{uuid4().hex}"
    ddl_path = Path(__file__).parents[2] / "alembic" / "sql" / "0001_initial.sql"
    fixture = """
        SET LOCAL search_path = dms, pg_catalog;
        INSERT INTO dms.district (code,name)
          SELECT 'DEMO_DISTRICT_'||n,'Quận mẫu '||n FROM generate_series(1,20) n;
        INSERT INTO dms.unit (code,name,"allowsFraction") VALUES
          ('PIECE','Cái',false), ('KG','Kilôgam',true) ON CONFLICT (code) DO NOTHING;
        INSERT INTO dms.product (name,"unitId","lowStockThreshold")
          SELECT 'Mặt hàng mẫu '||n,
            (SELECT id FROM dms.unit WHERE code=CASE WHEN n<=3 THEN 'PIECE'
              ELSE 'KG' END),5 FROM generate_series(1,5) n;
    """
    with connection.connection.driver_connection.cursor() as cursor:
        for script in (
            ddl_path.read_text(encoding="utf-8"),
            fixture,
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
            print("PASS: 29 tables, timestamps, document/ledger/cache/audit/report integrity")
            connection.rollback()
            if args.regression:
                transaction = connection.begin()
                try:
                    checks = run_regression(connection)
                    print(f"PASS: {checks} PostgreSQL regression assertions/rejections")
                finally:
                    transaction.rollback()
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
