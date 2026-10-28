from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.db.seed import main as seed_main
from app.modules.document_history.service import DocumentHistoryService
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_all_seven_seeded_kinds_historical_revisions_and_scoped_pages(database_factory):
    with database_factory() as engine:
        with patch("app.db.seed.build_engine", return_value=engine):
            seed_main()
        with Session(engine) as session:
            actor = session.scalar(text("SELECT id FROM dms.app_user ORDER BY id LIMIT 1"))
            use = DocumentHistoryService(
                session, CursorCodec(b"x" * 32), actor, "history-read", lambda _: None
            )
            for kind in (
                "STOCK_RECEIPT",
                "STOCK_ISSUE",
                "STOCK_ADJUSTMENT",
                "PAYMENT_RECEIPT",
                "SALES_RETURN",
                "CREDIT_APPLICATION",
                "REFUND",
            ):
                page = use.search(kind=kind, limit=1, sort="id")
                assert page.items and page.items[0].kind == kind
                assert_schema(page.model_dump(mode="json"), "DocumentListResponse")
                item = page.items[0]
                revisions = use.revisions(int(item.id), state=None)
                assert revisions.items
                revision = use.revision(int(item.id), revisions.items[0].revisionNo)
                assert_schema(revision.model_dump(mode="json"), "Revision")
                if kind in ("PAYMENT_RECEIPT", "CREDIT_APPLICATION", "REFUND"):
                    assert use.lines(int(item.id), revision.revisionNo).items == []
                if page.pagination.hasMore:
                    next_page = use.search(
                        kind=kind, limit=1, sort="id", cursor=page.pagination.nextCursor
                    )
                    assert next_page.items[0].id != item.id
            multiple = session.scalar(
                text(
                    'SELECT "documentId" FROM dms.document_revision '
                    "GROUP BY 1 HAVING count(*)>1 LIMIT 1"
                )
            )
            for sort in ("revisionNo", "-revisionNo"):
                page = use.revisions(multiple, limit=1, sort=sort)
                assert page.pagination.hasMore
                assert (
                    use.revisions(multiple, limit=1, sort=sort, cursor=page.pagination.nextCursor)
                    .items[0]
                    .id
                    != page.items[0].id
                )


def test_live_kind_filtering_financial_line_rejection_and_print_negotiation(
    history_client, engine, trading
):
    client = history_client
    payment = client.post(
        "/api/v1/payment-receipts",
        json={
            "agencyId": trading["agency"],
            "businessDate": "2026-01-04",
            "amount": "1",
            "paymentMethod": "CASH",
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert payment.status_code == 201, payment.text
    identifier = payment.json()["id"]
    base = f"/api/v1/documents/{identifier}/revisions/1/lines"
    body = {
        "kind": "STOCK_RECEIPT",
        "productId": trading["product"],
        "quantity": "1",
        "unitPrice": "1",
    }
    assert client.get(base).json()["items"] == []
    assert (
        client.post(
            base,
            json=body,
            headers={"If-Match": payment.headers["ETag"], "Idempotency-Key": str(uuid4())},
        ).status_code
        == 409
    )
    assert (
        client.get(
            f"/api/v1/documents/{identifier}/print", headers={"Accept": "image/png"}
        ).status_code
        == 406
    )
    html = client.get(f"/api/v1/documents/{identifier}/print")
    assert html.status_code == 200 and "BẢN NHÁP" in html.text
    pdf = client.get(
        f"/api/v1/documents/{identifier}/print",
        params={"revisionNo": 1},
        headers={"Accept": "application/pdf"},
    )
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")
    assert pdf.headers["Content-Type"] == "application/pdf"
    page = client.get("/api/v1/documents", params={"limit": 1, "sort": "id"})
    assert page.status_code == 200, page.text
    cursor = page.json()["pagination"]["nextCursor"]
    with engine.begin() as connection:
        connection.execute(
            text(
                'UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1 '
                'AND "functionId" NOT IN '
                "(SELECT id FROM dms.app_function WHERE code='inventory.read')"
            )
        )
    filtered = client.get("/api/v1/documents")
    assert filtered.status_code == 200, filtered.text
    assert {item["kind"] for item in filtered.json()["items"]} == {"STOCK_RECEIPT"}
    assert client.get("/api/v1/documents", params={"kind": "PAYMENT_RECEIPT"}).status_code == 403
    assert (
        client.get(
            "/api/v1/documents", params={"limit": 1, "sort": "id", "cursor": cursor}
        ).status_code
        == 400
    )
    assert client.get(base).status_code == 403
