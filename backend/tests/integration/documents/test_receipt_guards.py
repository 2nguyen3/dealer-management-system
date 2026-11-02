from datetime import date
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError, AuthError
from app.modules.document_core.service import DocumentService
from app.modules.stock_receipts.schemas import Reason, StockHeaderUpdate, StockReceiptCreate
from app.modules.stock_receipts.service import StockReceiptService
from tests.integration.documents.test_receipts import post_receipt, receipt
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_list_filters_all_sorts_and_snapshot_freeze(client, engine, actor, product):
    one = receipt(client, product, quantity="2", note="Match %_ literally")
    two = receipt(client, product, business_date="2026-10-02", quantity="3")
    with Session(engine) as session:
        service = StockReceiptService(
            session, CursorCodec(b"x" * 32), actor, "list", lambda _: None
        )
        assert len(service.list().items) == 2
    path = "/api/v1/stock-receipts"
    for sort in StockReceiptService.sorts:
        response = client.get(path, params={"sort": sort, "limit": 1})
        assert response.status_code == 200, response.text
        page = response.json()
        next_page = client.get(
            path, params={"sort": sort, "limit": 1, "cursor": page["pagination"]["nextCursor"]}
        )
        assert next_page.status_code == 200, next_page.text
        assert next_page.json()["items"][0]["id"] != page["items"][0]["id"]
        assert_schema(page, "DocumentListResponse")
        assert_schema(next_page.json(), "DocumentListResponse")
    filtered = client.get(
        path,
        params={
            "productId": product["id"],
            "fromDate": "2026-10-01",
            "toDate": "2026-10-02",
            "status": "DRAFT",
            "code": one.json()["code"],
            "q": "%_",
        },
    ).json()
    assert len(filtered["items"]) == 1 and filtered["items"][0]["id"] == one.json()["id"]
    assert len(client.get(path, params={"q": "Grain"}).json()["items"]) == 2
    assert client.get(path, params={"productId": "99999"}).json()["items"] == []
    assert (
        client.get(path, params={"fromDate": "2026-10-02", "toDate": "2026-10-01"}).status_code
        == 422
    )
    assert client.get(path, params={"cursor": "tampered"}).status_code == 400
    current = client.get("/api/v1/products/" + product["id"])
    changed = client.patch(
        "/api/v1/products/" + product["id"],
        json={"name": "New name"},
        headers={"If-Match": current.headers["ETag"]},
    )
    assert changed.status_code == 200
    posted = post_receipt(client, one)
    assert posted.status_code == 200, posted.text
    frozen = client.get(one.headers["Location"]).json()["currentRevision"]["lines"][0]
    assert frozen["productName"] == "New name"
    client.patch(
        "/api/v1/products/" + product["id"],
        json={"name": "Later name"},
        headers={"If-Match": client.get("/api/v1/products/" + product["id"]).headers["ETag"]},
    )
    assert client.get(one.headers["Location"]).json()["currentRevision"]["lines"][0] == frozen
    page = client.get(path, params={"sort": "-businessDate", "limit": 1}).json()
    client.patch(
        two.headers["Location"],
        json={"businessDate": "2026-10-03"},
        headers={"If-Match": two.headers["ETag"]},
    )
    assert (
        client.get(
            path, params={"sort": "-businessDate", "cursor": page["pagination"]["nextCursor"]}
        ).status_code
        == 400
    )


def test_empty_rounded_zero_and_inactive_receipts_never_post(client, engine, product):
    empty = client.post(
        "/api/v1/stock-receipts",
        json={"businessDate": "2026-10-01"},
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert empty.status_code == 201 and post_receipt(client, empty).status_code == 409
    zero = receipt(client, product, quantity="0.001", price="1")
    assert zero.json()["totalAmount"] == "0" and post_receipt(client, zero).status_code == 409
    active = receipt(client, product)
    current = client.get("/api/v1/units/" + str(product["unitId"]))
    client.patch(
        "/api/v1/units/" + str(product["unitId"]),
        json={"status": "INACTIVE"},
        headers={"If-Match": current.headers["ETag"]},
    )
    assert post_receipt(client, active).status_code == 409
    assert (
        client.post(
            "/api/v1/stock-receipts",
            json={
                "businessDate": "2026-10-01",
                "lines": [{"productId": product["id"], "quantity": "1", "unitPrice": "100"}],
            },
            headers={"Idempotency-Key": str(uuid4())},
        ).status_code
        == 409
    )
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.inventory_entry").scalar() == 0
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.posting_batch").scalar() == 0
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.api_idempotency").scalar() == 3


@pytest.mark.parametrize(
    "invalid,status",
    [
        ({"productId": "99999"}, 404),
        ({"quantity": "0"}, 422),
        ({"quantity": "-1"}, 422),
        ({"quantity": "1.0001"}, 422),
        ({"quantity": 1}, 422),
        ({"unitPrice": "0"}, 422),
        ({"unitPrice": "1.1"}, 422),
        ({"unitPrice": 100}, 422),
        ({"quantity": "999999999999999.999", "unitPrice": "999999999999999999"}, 409),
    ],
)
def test_invalid_receipt_input_rolls_back_command_and_audit(
    client, engine, product, invalid, status
):
    response = client.post(
        "/api/v1/stock-receipts",
        json={
            "businessDate": "2026-10-01",
            "lines": [{"productId": product["id"], "quantity": "1", "unitPrice": "100", **invalid}],
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert response.status_code == status, response.text
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.document").scalar() == 0
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.api_idempotency").scalar() == 0
        assert (
            connection.execute(
                text('SELECT count(*) FROM dms.audit_log WHERE "requestId"=:id'),
                {"id": response.headers["X-Request-Id"]},
            ).scalar()
            == 0
        )


def test_duplicate_product_integer_unit_missing_preconditions_and_wrong_kind(
    client, engine, actor, product
):
    line = {"productId": product["id"], "quantity": "1", "unitPrice": "100"}
    assert (
        client.post(
            "/api/v1/stock-receipts",
            json={"businessDate": "2026-10-01", "lines": [line, line]},
            headers={"Idempotency-Key": str(uuid4())},
        ).status_code
        == 409
    )
    assert (
        client.post("/api/v1/stock-receipts", json={"businessDate": "2026-10-01"}).status_code
        == 422
    )
    unit = client.post("/api/v1/units", json={"code": "PCS", "name": "Piece"}).json()["id"]
    other = client.post("/api/v1/products", json={"name": "Piece", "unitId": unit}).json()
    invalid = client.post(
        "/api/v1/stock-receipts",
        json={
            "businessDate": "2026-10-01",
            "lines": [{**line, "productId": other["id"], "quantity": "0.125"}],
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert invalid.status_code == 409
    created = receipt(client, product)
    path = created.headers["Location"]
    assert client.post(path + "/post", headers={"Idempotency-Key": str(uuid4())}).status_code == 428
    assert (
        client.post(
            path + "/post", headers={"If-Match": '"stale"', "Idempotency-Key": str(uuid4())}
        ).status_code
        == 412
    )
    for body in ({}, {"businessDate": None}, {"lines": []}, {"totalAmount": "1"}, {"note": 1}):
        assert (
            client.patch(path, json=body, headers={"If-Match": created.headers["ETag"]}).status_code
            == 422
        )
    assert (
        client.post(
            "/api/v1/stock-receipts",
            content="not-json",
            headers={"Content-Type": "text/plain", "Idempotency-Key": str(uuid4())},
        ).status_code
        == 415
    )
    assert client.get("/api/v1/stock-receipts/999999").status_code == 404
    assert (
        client.patch(
            "/api/v1/stock-receipts/999999",
            json={"note": "missing"},
            headers={"If-Match": created.headers["ETag"]},
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/v1/stock-receipts/999999/post",
            headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
        ).status_code
        == 404
    )
    with Session(engine) as session:
        core = DocumentService(session, CursorCodec(b"x" * 32), actor, "wrong-kind", lambda _: None)
        adjustment = core.create_draft("STOCK_ADJUSTMENT", date(2026, 10, 1), uuid4())
        session.commit()
    assert client.get(f"/api/v1/stock-receipts/{adjustment}").status_code == 404
    assert (
        client.patch(
            f"/api/v1/stock-receipts/{adjustment}",
            json={"note": "wrong"},
            headers={"If-Match": '"x"'},
        ).status_code
        == 404
    )


def test_definite_commit_failure_rolls_back_each_receipt_workflow(client, engine, actor, product):
    created = receipt(client, product)
    identifier = int(created.json()["id"])
    body = StockReceiptCreate(
        businessDate="2026-10-02",
        lines=[{"productId": product["id"], "quantity": "1", "unitPrice": "100"}],
    )
    with Session(engine) as session:
        service = StockReceiptService(
            session, CursorCodec(b"x" * 32), actor, "receipt-rollback", lambda _: None
        )
        with patch.object(session, "commit", side_effect=RuntimeError("forced definite failure")):
            for operation in (
                lambda: service.create(body, uuid4()),
                lambda: service.update(
                    identifier,
                    StockHeaderUpdate(note="Rollback"),
                    Preconditions(created.headers["ETag"]),
                ),
                lambda: service.post(identifier, Preconditions(created.headers["ETag"]), uuid4()),
                lambda: service.cancel_draft(
                    identifier,
                    Reason(reason="Rollback"),
                    Preconditions(created.headers["ETag"]),
                    uuid4(),
                ),
            ):
                with pytest.raises(RuntimeError):
                    operation()
    assert client.get(created.headers["Location"]).json()["status"] == "DRAFT"
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.document").scalar() == 1
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.document_line").scalar() == 1
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.inventory_entry").scalar() == 0
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.posting_batch").scalar() == 0
        assert connection.exec_driver_sql("SELECT count(*) FROM dms.api_idempotency").scalar() == 1
        assert (
            connection.exec_driver_sql(
                "SELECT count(*) FROM dms.audit_log WHERE \"requestId\"='receipt-rollback'"
            ).scalar()
            == 0
        )


def test_internal_draft_cancel_requires_only_cancel_and_preserves_lines(
    client, engine, actor, product
):
    created = receipt(client, product)
    key = uuid4()

    def authorize(required):
        if required != ("documents.cancel",):
            raise AuthError(403, "FORBIDDEN", "Denied")

    with Session(engine) as session:
        service = StockReceiptService(
            session, CursorCodec(b"x" * 32), actor, "draft-cancel", authorize
        )
        condition = Preconditions(created.headers["ETag"])
        cancelled = service.cancel_draft(
            int(created.json()["id"]), Reason(reason="Not received"), condition, key
        )
        assert cancelled.body["status"] == "CANCELLED" and cancelled.body["inventoryChanges"] == []
        assert (
            service.cancel_draft(
                int(created.json()["id"]), Reason(reason="Not received"), condition, key
            )
            == cancelled
        )
        with pytest.raises(ApiError) as error:
            service.cancel_draft(
                int(created.json()["id"]),
                Reason(reason="Again"),
                Preconditions(cancelled.headers["ETag"]),
                uuid4(),
            )
        assert error.value.code == "STATE_CONFLICT"
    detail = client.get(created.headers["Location"]).json()
    assert len(detail["currentRevision"]["lines"]) == 1
    assert detail["cancelReason"] == "Not received"
    assert client.get("/api/v1/products/" + product["id"]).json()["currentStock"] == "0"
