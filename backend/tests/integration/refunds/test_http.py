from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.refunds.router import router
from tests.integration.settlement_core.helpers import commit
from tests.integration.settlement_core.test_reservations import credit_cash
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_manual_http_contract_grants_parent_etags_and_evidence_filters(
    client, engine, actor, trading
):
    client.app.include_router(router, prefix="/api/v1")
    with Session(engine) as session:
        receipt, _ = credit_cash(
            session, actor, (int(trading["agency"]), int(trading["product"])), 100
        )
        commit(session)

    def create(amount):
        result = client.post(
            "/api/v1/refunds",
            json={
                "originDocumentId": str(receipt),
                "businessDate": "2026-01-04",
                "amount": amount,
                "paymentMethod": "CASH",
            },
            headers={"Idempotency-Key": str(uuid4())},
        )
        assert result.status_code == 201, result.text
        return result

    created = create("40")
    path = created.headers["Location"]
    assert_schema(client.get(path).json(), "Refund")
    assert client.patch(path, json={"amount": "30"}).status_code == 428
    updated = client.patch(
        path,
        json={"amount": "30", "note": "Cash payout"},
        headers={"If-Match": created.headers["ETag"]},
    )
    assert updated.status_code == 200, updated.text
    ready = client.post(
        path + "/submit",
        headers={"If-Match": updated.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert ready.status_code == 200, ready.text
    reservations = client.get(
        path + "/reservations", params={"state": "ACTIVE", "sort": "id", "limit": 1}
    )
    assert reservations.status_code == 200, reservations.text
    assert reservations.json()["items"][0]["amount"] == "30"
    assert client.get(path + "/attempts").json()["items"] == []
    paid = client.post(
        path + "/confirm-paid",
        json={"paidAt": "2026-01-05T00:00:00Z", "evidenceReference": "cash-1"},
        headers={"If-Match": ready.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert paid.status_code == 200, paid.text
    draft = create("10")
    canceled = client.post(
        draft.headers["Location"] + "/cancel",
        json={"reason": "No payout"},
        headers={"If-Match": draft.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert canceled.status_code == 200, canceled.text
    with engine.connect() as check:
        audit = check.execute(
            text(
                'SELECT "functionCode","actorId","requestId" FROM dms.audit_log '
                'WHERE "entityName"=\'document\' AND "entityKey"=:id '
                "AND \"newData\"->>'status'='CANCELLED' "
                "ORDER BY id DESC LIMIT 1"
            ),
            {"id": draft.json()["id"]},
        ).one()
        assert tuple(audit) == ("documents.cancel", actor, canceled.headers["X-Request-Id"])
    page = client.get(
        "/api/v1/refunds", params={"limit": 1, "sort": "id", "agencyId": trading["agency"]}
    )
    assert page.status_code == 200, page.text
    cursor = page.json()["pagination"]["nextCursor"]
    assert (
        client.get(
            "/api/v1/refunds",
            params={"limit": 1, "sort": "id", "agencyId": trading["agency"], "cursor": cursor},
        ).json()["items"][0]["id"]
        != page.json()["items"][0]["id"]
    )
    assert client.get("/api/v1/refunds", params={"attemptState": "FAILED"}).json()["items"] == []
    assert client.get("/api/v1/refund-attempts/999999").status_code == 404
    adapter = Mock()
    with patch("app.modules.refunds.dependencies.adapter_for", return_value=adapter):
        detail = client.get(path)
        response = client.post(
            path + "/attempts",
            headers={"If-Match": detail.headers["ETag"], "Idempotency-Key": str(uuid4())},
        )
        assert response.status_code == 409, response.text
