from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.config import Settings
from app.core.exceptions import AuthError
from app.modules.auth.service import AuthService
from app.modules.payment_receipts.schemas import PaymentReceiptCreate
from app.modules.payment_receipts.service import PaymentReceiptService
from app.modules.stock_issues.schemas import StockIssueCreate
from app.modules.stock_issues.service import StockIssueService
from app.modules.upfront_payments.schemas import UpfrontCreate
from app.modules.upfront_payments.service import UpfrontPaymentService
from tests.integration.workflows.test_races import ordered_race, ready_issue, service

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("workflow", ["issue", "receipt", "replay"])
def test_grant_revocation_after_observed_lock_wait_denies_fresh_and_replayed_writes(
    engine, actor, trading, workflow
):
    settings = Settings(
        _env_file=None,
        db_host="localhost",
        db_user="test",
        db_password="test",
        auth_signing_key="synthetic-test-key-32-bytes-or-more",
    )
    with Session(engine) as session:
        ready = ready_issue(session, actor, trading)
        permission = "stock.issue.post" if workflow == "issue" else "cash.receipt.post"
        if workflow != "issue":
            service(StockIssueService, session, actor).post(
                int(ready.body["id"]), Preconditions(ready.headers["ETag"]), uuid4()
            )
            ready = service(PaymentReceiptService, session, actor).create(
                PaymentReceiptCreate(
                    agencyId=trading["agency"],
                    businessDate="2026-01-03",
                    amount="100",
                    paymentMethod="CASH",
                ),
                uuid4(),
            )
        key = uuid4()
        cls = StockIssueService if workflow == "issue" else PaymentReceiptService
        auth = AuthService(session, settings, None)
        tokens = auth.login("test@example.com", "password")
        principal = auth.authenticate(tokens.accessToken)
        session.rollback()

    def revoke(session):
        if workflow == "replay":
            from unittest.mock import patch

            original_commit = session.commit

            def revoke_before_commit():
                session.execute(
                    text("""
                    UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1
                    AND "functionId"=(SELECT id FROM dms.app_function WHERE code=:permission)
                """),
                    {"permission": permission},
                )
                original_commit()

            with patch.object(session, "commit", side_effect=revoke_before_commit):
                service(cls, session, actor).post(
                    int(ready.body["id"]), Preconditions(ready.headers["ETag"]), key
                )
            return "revoked"
        else:
            session.execute(
                text('SELECT "agencyId" FROM dms.agency_balance WHERE "agencyId"=:id FOR UPDATE'),
                {"id": int(trading["agency"])},
            )
        session.execute(
            text("""
            UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1
              AND "functionId"=(SELECT id FROM dms.app_function WHERE code=:permission)
        """),
            {"permission": permission},
        )
        session.commit()
        return "revoked"

    def post(session):
        auth = AuthService(session, settings, None)

        def authorize(required):
            if not set(required) <= set(auth.get_current_user(principal).allowedFunctions):
                raise AuthError(403, "FORBIDDEN", "Permission denied")

        writer = cls(session, CursorCodec(b"x" * 32), actor, "post-wait", authorize)
        return writer.post(int(ready.body["id"]), Preconditions(ready.headers["ETag"]), key)

    assert ordered_race(engine, revoke, post) == ("revoked", "FORBIDDEN")
    with engine.connect() as c:
        status = c.scalar(
            text("SELECT status FROM dms.document WHERE id=:id"), {"id": int(ready.body["id"])}
        )
        assert status == (
            "POSTED" if workflow == "replay" else "PENDING" if workflow == "issue" else "DRAFT"
        )
        assert (
            c.scalar(text("SELECT count(*) FROM dms.audit_log WHERE \"requestId\"='post-wait'"))
            == 0
        )


def test_http_read_permissions_and_no_extra_cash_permission_for_issue_post(
    client, engine, trading, actor
):
    with Session(engine) as s:
        draft = service(StockIssueService, s, actor).create(
            StockIssueCreate(agencyId=trading["agency"], businessDate="2026-01-02"), uuid4()
        )
    policies = {
        "/api/v1/stock-issues": (
            "stock.issue.prepare",
            "stock.issue.post",
            "debt.read",
            "sales.read",
        ),
        "/api/v1/payment-receipts": ("cash.receipt.prepare", "cash.receipt.post", "debt.read"),
        "/api/v1/upfront-confirmations": (
            "cash.upfront.verify",
            "cash.receipt.post",
            "stock.issue.post",
        ),
        "/api/v1/receivables": ("debt.read",),
        "/api/v1/agencies/" + trading["agency"] + "/balance": (
            "debt.read",
            "credit.apply",
            "cash.refund.post",
        ),
    }
    for path, permissions in policies.items():
        for permission in permissions:
            with engine.begin() as c:
                c.execute(
                    text("""UPDATE dms.group_permission SET "isAllowed"=
                    ("functionId"=(SELECT id FROM dms.app_function WHERE code=:code))
                    WHERE "groupId"=1"""),
                    {"code": permission},
                )
            response = client.get(path)
            assert response.status_code == 200, response.text
            if path == "/api/v1/receivables":
                assert "email" not in response.json()["items"][0]
        with engine.begin() as c:
            c.execute(text('UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1'))
        assert client.get(path).status_code == 403
        assert client.get(path, headers={"Authorization": ""}).status_code == 401
    with engine.begin() as c:
        c.execute(text('UPDATE dms.group_permission SET "isAllowed"=true WHERE "groupId"=1'))
    assert client.get("/api/v1/stock-issues/" + draft.body["id"]).status_code == 200
    with Session(engine) as s:
        ready = ready_issue(s, actor, trading, immediate="200")
        service(UpfrontPaymentService, s, actor).verify(
            UpfrontCreate(
                issueRevisionId=ready.body["revisionId"],
                amount="200",
                method="CASH",
                receivedAt="2026-01-02T01:00:00Z",
            ),
            uuid4(),
        )
    with engine.begin() as c:
        c.execute(
            text("""UPDATE dms.group_permission SET "isAllowed"=
            ("functionId"=(SELECT id FROM dms.app_function WHERE code='stock.issue.post'))
            WHERE "groupId"=1""")
        )
    path = "/api/v1/stock-issues/" + ready.body["id"]
    posted = client.post(
        path + "/post",
        headers={"If-Match": client.get(path).headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert posted.status_code == 200, posted.text
    assert posted.json()["autoReceiptId"] is not None
    assert posted.json()["agencyBalance"]["currentDebt"] == "106"
