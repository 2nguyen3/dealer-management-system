from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.db.seed import main as seed_main
from app.db.verify import check_database, run_regression
from app.modules.payment_receipts.schemas import PaymentReceiptCreate
from app.modules.payment_receipts.service import PaymentReceiptService
from app.modules.receivables.service import ReceivableService
from app.modules.stock_issues.schemas import PendingIssueRevision, StockIssueCreate
from app.modules.stock_issues.service import StockIssueService
from app.modules.upfront_payments.schemas import UpfrontCreate
from app.modules.upfront_payments.service import UpfrontPaymentService
from tests.integration.workflows.test_races import service
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_seeded_mixed_history_accepts_backdated_writers_and_retains_all_money_evidence(
    database_factory,
):
    with database_factory() as engine:
        with (
            patch("app.db.seed.build_engine", return_value=engine),
            patch(
                "app.db.seed.get_settings",
                return_value=SimpleNamespace(database_url=lambda: engine.url),
            ),
        ):
            seed_main()
            seed_main()
        with engine.connect() as c:
            assert check_database(c, seeded=True)["document"] == 410
            c.rollback()
            with c.begin() as transaction:
                assert run_regression(c) == 54
                transaction.rollback()
        with Session(engine) as s:
            actor = s.scalar(text("SELECT id FROM dms.app_user WHERE email='quanly@agentra.demo'"))
            before = {
                name: s.execute(text(f"SELECT to_jsonb(t) FROM dms.{name} t ORDER BY id")).all()
                for name in (
                    "upfront_confirmation",
                    "online_payment",
                    "refund_attempt",
                    "refund_reservation",
                    "document_revision",
                )
            }
            agencies = s.execute(
                text(
                    'SELECT "agencyId","currentDebt" FROM dms.agency_balance '
                    'WHERE "currentDebt">0 ORDER BY "agencyId"'
                )
            ).all()
            reads = service(ReceivableService, s, actor)
            for agency_id, debt in agencies:
                statement = reads.statement(agency_id, limit=100, effectiveOnly=False)
                assert statement.closingDebt == debt
                assert_schema(statement.model_dump(mode="json"), "ReceivableStatement")
            candidate = s.execute(
                text("""
                SELECT d."agencyId",r."businessDate",r."totalAmount",l."productId"
                FROM dms.document d JOIN dms.document_revision r ON r.id=d."currentRevisionId"
                  JOIN dms.document_line l ON l."revisionId"=r.id
                  JOIN dms.agency a ON a.id=d."agencyId"
                  JOIN dms.product p ON p.id=l."productId"
                  JOIN dms.inventory_balance b ON b."productId"=p.id
                WHERE d.kind='STOCK_ISSUE' AND d.status='POSTED' AND a.status='ACTIVE'
                  AND p.status='ACTIVE' AND b."currentStock">1
                ORDER BY r."businessDate",d."businessOrder",l.id LIMIT 1
            """)
            ).one()
            issues = service(StockIssueService, s, actor)
            draft = issues.create(
                StockIssueCreate(
                    agencyId=str(candidate.agencyId),
                    businessDate=candidate.businessDate,
                    lines=[{"productId": str(candidate.productId), "quantity": "1"}],
                ),
                uuid4(),
            )
            ready = issues.submit(
                int(draft.body["id"]), Preconditions(draft.headers["ETag"]), uuid4()
            )
            # An unpaid backdated sale consumes cash that already funds a later credit
            # application: that history really is invalid, rather than unsupported.
            with pytest.raises(ApiError, match="INSUFFICIENT_CREDIT"):
                issues.post(int(draft.body["id"]), Preconditions(ready.headers["ETag"]), uuid4())
            revised = issues.replace_pending(
                int(draft.body["id"]),
                PendingIssueRevision(
                    businessDate=candidate.businessDate,
                    reason="Pay this new sale in full",
                    immediatePayment=ready.body["totalAmount"],
                    lines=[{"productId": str(candidate.productId), "quantity": "1"}],
                ),
                Preconditions(ready.headers["ETag"]),
                uuid4(),
            )
            ready = issues.submit(
                int(draft.body["id"]), Preconditions(revised.headers["ETag"]), uuid4()
            )
            service(UpfrontPaymentService, s, actor).verify(
                UpfrontCreate(
                    issueRevisionId=ready.body["revisionId"],
                    amount=ready.body["totalAmount"],
                    method="CASH",
                    receivedAt=candidate.businessDate.isoformat() + "T03:00:00Z",
                ),
                uuid4(),
            )
            current = issues.get(int(draft.body["id"]))
            result = issues.post(int(current.id), Preconditions(issues.etag(current)), uuid4())
            assert result.body["status"] == "POSTED"
            receipts = service(PaymentReceiptService, s, actor)
            eligible = s.execute(
                text("""
                SELECT a.id FROM dms.agency a JOIN dms.agency_balance b ON b."agencyId"=a.id
                WHERE b."currentDebt">0 AND a.id<>:id
                  AND NOT EXISTS(SELECT 1 FROM dms.credit_lot l WHERE l."agencyId"=a.id)
                ORDER BY a.id LIMIT 1
            """),
                {"id": candidate.agencyId},
            ).scalar_one()
            payment = receipts.create(
                PaymentReceiptCreate(
                    agencyId=str(eligible),
                    businessDate="2026-09-30",
                    amount="1",
                    paymentMethod="CASH",
                ),
                uuid4(),
            )
            receipts.post(int(payment.body["id"]), Preconditions(payment.headers["ETag"]), uuid4())
            for table, rows in before.items():
                current = s.execute(
                    text(f"SELECT to_jsonb(t) FROM dms.{table} t ORDER BY id")
                ).all()
                assert current[: len(rows)] == rows
            s.rollback()
        with engine.connect() as c:
            assert check_database(c, seeded=True)["document"] == 413
