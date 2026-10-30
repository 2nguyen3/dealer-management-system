from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.integration.document_corrections.helpers import snapshot
from tests.integration.settlement_core.helpers import commit, issue

pytestmark = pytest.mark.integration


def test_every_correction_owner_rejects_wrong_kind_and_transport_without_effects(
    client, engine, actor, trading
):
    with Session(engine) as session:
        invoice = issue(session, actor, trading)
        commit(session)
        receipt = session.scalar(text("SELECT id FROM dms.document WHERE kind='STOCK_RECEIPT'"))
    bodies = {
        "stock-receipts": {
            "lines": [{"productId": str(trading[1]), "quantity": "1", "unitPrice": "1"}]
        },
        "stock-adjustments": {"lines": [{"productId": str(trading[1]), "quantity": "1"}]},
        "stock-issues": {"lines": [{"productId": str(trading[1]), "quantity": "1"}]},
        "payment-receipts": {"amount": "1", "paymentMethod": "CASH"},
        "sales-returns": {"lines": [{"originLineId": "999999", "quantity": "1"}]},
        "credit-applications": {"amount": "1"},
    }
    before = snapshot(engine)
    authorization = client.headers.pop("Authorization")
    for owner in bodies:
        for action in ("corrections", "cancel"):
            denied = client.post(
                f"/api/v1/{owner}/999999999/{action}",
                json={"reason": "Unauthenticated"},
                headers={"If-Match": '"synthetic"', "Idempotency-Key": str(uuid4())},
            )
            assert denied.status_code == 401, denied.text
    client.headers["Authorization"] = authorization
    for owner, fields in bodies.items():
        identifier = invoice if owner == "stock-receipts" else receipt
        for action in ("corrections", "cancel"):
            body = (
                {"businessDate": "2026-01-02", "reason": "Wrong kind", **fields}
                if action == "corrections"
                else {"reason": "Wrong kind"}
            )
            headers = {"If-Match": '"synthetic"', "Idempotency-Key": str(uuid4())}
            path = f"/api/v1/{owner}/{identifier}/{action}"
            denied = client.post(path, json=body, headers=headers)
            assert denied.status_code == 404, denied.text
            for content, media, status in (
                ("{}", "text/plain", 415),
                ("{", "application/json", 400),
            ):
                invalid = client.post(
                    path, content=content, headers={**headers, "Content-Type": media}
                )
                assert invalid.status_code == status, invalid.text
    assert snapshot(engine) == before
