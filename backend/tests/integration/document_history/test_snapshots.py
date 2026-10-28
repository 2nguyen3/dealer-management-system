from uuid import uuid4

import pytest
from sqlalchemy import text

pytestmark = pytest.mark.integration


def test_old_ready_revision_snapshot_and_print_survive_replacement_and_master_rename(
    history_client, engine, trading
):
    client = history_client
    created = client.post(
        "/api/v1/stock-issues",
        json={
            "agencyId": trading["agency"],
            "businessDate": "2026-01-04",
            "lines": [{"productId": trading["product"], "quantity": "1"}],
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert created.status_code == 201, created.text
    ready = client.post(
        created.headers["Location"] + "/submit",
        headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert ready.status_code == 200, ready.text
    identifier = created.json()["id"]
    base = f"/api/v1/documents/{identifier}"
    snapshot = client.get(base + "/revisions/1").json()
    printed = client.get(base + "/print", params={"revisionNo": 1}).text
    replaced = client.post(
        created.headers["Location"] + "/revisions",
        json={
            "businessDate": "2026-01-05",
            "reason": "Replace pending agreement",
            "immediatePayment": "0",
            "lines": [{"productId": trading["product"], "quantity": "2"}],
        },
        headers={"If-Match": ready.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert replaced.status_code == 201, replaced.text
    with engine.begin() as check:
        check.execute(
            text("UPDATE dms.product SET name='Renamed product' WHERE id=:id"),
            {"id": int(trading["product"])},
        )
        check.execute(
            text("UPDATE dms.agency SET name='Renamed agency' WHERE id=:id"),
            {"id": int(trading["agency"])},
        )
    assert client.get(base + "/revisions/1").json() == snapshot
    assert client.get(base + "/print", params={"revisionNo": 1}).text == printed
    line = snapshot["lines"][0]
    detail = client.get(created.headers["Location"])
    assert (
        client.delete(
            base + f"/revisions/1/lines/{line['id']}", headers={"If-Match": detail.headers["ETag"]}
        ).status_code
        == 404
    )
    assert client.get(base + f"/revisions/2/lines/{line['id']}").status_code == 404
