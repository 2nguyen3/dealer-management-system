from threading import Event
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import AuthError
from app.core.request_context import set_audit_context
from app.modules.auth.service import AuthService
from app.modules.document_history.schemas import ReceiptLine
from app.modules.document_history.service import DocumentHistoryService
from app.modules.inventory.repository import InventoryRepository
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.user_groups.test_group_concurrency import wait_for_blocker
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


def create(client, trading):
    value = client.post(
        "/api/v1/stock-receipts",
        json={
            "businessDate": "2026-01-04",
            "lines": [{"productId": trading["product"], "quantity": "2", "unitPrice": "50"}],
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert value.status_code == 201, value.text
    detail = client.get(value.headers["Location"])
    return (
        int(value.json()["id"]),
        int(detail.json()["currentRevision"]["lines"][0]["id"]),
        value.headers["ETag"],
    )


def use(session, actor, authorize=lambda _: None):
    return DocumentHistoryService(session, CursorCodec(b"x" * 32), actor, "history-race", authorize)


def test_competing_child_edits_serialize_on_complete_parent_and_rollback_total(
    history_client, engine, actor, trading
):
    identifier, line_id, token = create(history_client, trading)

    def edit(session, quantity):
        body = ReceiptLine(
            kind="STOCK_RECEIPT", productId=trading["product"], quantity=quantity, unitPrice="50"
        )
        return (
            use(session, actor)
            .change_line(identifier, 1, Preconditions(token), body, line_id)
            .body["quantity"]
        )

    assert ordered_race(engine, lambda s: edit(s, "3"), lambda s: edit(s, "4")) == (
        "3",
        "PRECONDITION_FAILED",
    )
    with Session(engine) as session:
        service = use(session, actor)
        current = service.core.get(identifier)
        condition = Preconditions(service.core.etag(current))
        session.rollback()
        original = service.core.repo.set_total

        def fail_after_total(*args):
            original(*args)
            raise RuntimeError("after-total")

        with patch.object(service.core.repo, "set_total", side_effect=fail_after_total):
            with pytest.raises(RuntimeError, match="after-total"):
                service.change_line(
                    identifier,
                    1,
                    condition,
                    ReceiptLine(
                        kind="STOCK_RECEIPT",
                        productId=trading["product"],
                        quantity="5",
                        unitPrice="50",
                    ),
                    line_id,
                )
    with engine.connect() as check:
        assert (
            check.scalar(
                text("SELECT quantity FROM dms.document_line WHERE id=:id"), {"id": line_id}
            )
            == 3
        )
        assert (
            check.scalar(
                text('SELECT "totalAmount" FROM dms.document_revision WHERE "documentId"=:id'),
                {"id": identifier},
            )
            == 150
        )


def test_live_prepare_grant_revoked_while_child_waits_for_stock(
    history_client, engine, actor, trading
):
    client = history_client
    identifier, line_id, token = create(client, trading)
    reached = Event()

    def revoke(session):
        InventoryRepository(session).lock_balances((int(trading["product"]),))
        set_audit_context(session, actor, "revoke-lines", function_code="permissions.manage")
        session.execute(
            text(
                'UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1 '
                'AND "functionId"=(SELECT id FROM dms.app_function '
                "WHERE code='stock.receipt.prepare')"
            )
        )
        session.commit()
        return "revoked"

    def attempt(session):
        auth = AuthService(session, client.app.state.settings, client.app.state.reset_delivery)
        principal = auth.authenticate(client.headers["Authorization"].removeprefix("Bearer "))

        def authorize(required):
            if not set(required) <= set(auth.get_current_user(principal).allowedFunctions):
                raise AuthError(403, "FORBIDDEN", "Permission denied")

        service = use(session, actor, authorize)
        original = service.inventory.lock_balances

        def lock(products):
            reached.set()
            return original(products)

        with patch.object(service.inventory, "lock_balances", side_effect=lock):
            return service.change_line(identifier, 1, Preconditions(token), line_id=line_id)

    def observe(database, pid):
        assert reached.wait(race_timeout(10))
        wait_for_blocker(database, pid)

    with patch("tests.integration.catalogues.test_races.wait_for_blocker", new=observe):
        assert ordered_race(engine, revoke, attempt) == ("revoked", "FORBIDDEN")
    with engine.connect() as check:
        assert (
            check.scalar(
                text("SELECT quantity FROM dms.document_line WHERE id=:id"), {"id": line_id}
            )
            == 2
        )
