"""/documents over HTTP with real login, permissions and PostgreSQL."""

from io import BytesIO

import pytest
from pypdf import PdfReader

from app.modules.document_core.schemas import StockIssueCorrection
from tests.integration.document_history.conftest import issue_body, match, post_new

pytestmark = pytest.mark.integration


def test_search_get_and_etag_match_the_kind_route(login, history, world):
    client = login()
    page = client.get("/api/v1/documents", params={"agencyId": str(world.agency), "sort": "id"})
    assert page.status_code == 200, page.text
    body = page.json()
    assert [item["code"] for item in body["items"]] == [history.issue.code, history.payment.code]
    assert body["pagination"] == {"limit": 25, "hasMore": False, "nextCursor": None}
    assert set(body["items"][0]) >= {"kind", "status", "replacesDocumentId", "agencyName"}

    detail = client.get(f"/api/v1/documents/{history.issue.id}")
    assert detail.status_code == 200
    assert detail.json()["lines"][0]["productName"] == "Mì Hảo Hảo thùng 30 gói"
    kind_route = client.get(f"/api/v1/stock-issues/{history.issue.id}")
    assert detail.headers["ETag"] == kind_route.headers["ETag"]


def test_search_query_validation(login, history):
    client = login()
    for params in (
        {"fromDate": history.day.isoformat(), "toDate": history.day.isoformat()},
        {"kind": "SALES_RETURN"},
        {"status": "PENDING"},
        {"agencyId": "abc"},
        {"limit": 0},
        {"limit": 101},
        {"sort": "code"},
    ):
        assert client.get("/api/v1/documents", params=params).status_code == 422, params
    assert client.get("/api/v1/documents", params={"cursor": "bogus"}).status_code == 400
    assert client.get("/api/v1/documents", params={"limit": 100}).status_code == 200


def test_chain_route_orders_original_to_latest(login, documents, history, world):
    issues = documents("STOCK_ISSUE")
    original = post_new(issues, issue_body(world.agency, (world.noodles, 5)))
    body = StockIssueCorrection.model_validate(
        {"reason": "Giao thêm", "lines": [{"productId": str(world.noodles), "quantity": "6"}]}
    )
    first = issues.correct(int(original.id), body, match(issues, original))
    body = StockIssueCorrection.model_validate(
        {"reason": "Giao bớt", "lines": [{"productId": str(world.noodles), "quantity": "3"}]}
    )
    second = issues.correct(int(first.id), body, match(issues, first))
    response = login().get(f"/api/v1/documents/{second.id}/chain")
    assert response.status_code == 200
    items = response.json()["items"]
    assert [(item["code"], item["status"], item["cancelReason"]) for item in items] == [
        (original.code, "CANCELLED", "Giao thêm"),
        (first.code, "CANCELLED", "Giao bớt"),
        (second.code, "POSTED", None),
    ]


def test_print_pdf_and_html(login, documents, history, world):
    client = login()
    issues = documents("STOCK_ISSUE")
    issue = issues.get(int(history.issue.id))
    body = StockIssueCorrection.model_validate(
        {"reason": "Sai số lượng", "lines": [{"productId": str(world.noodles), "quantity": "3"}]}
    )
    replacement = issues.correct(int(issue.id), body, match(issues, issue))

    pdf = client.get(f"/api/v1/documents/{issue.id}/print", headers={"Accept": "application/pdf"})
    assert pdf.status_code == 200 and pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF-")
    assert f'filename="{issue.code}.pdf"' in pdf.headers["content-disposition"]
    text = "\n".join(page.extract_text() for page in PdfReader(BytesIO(pdf.content)).pages)
    assert issue.code in text and "Phiếu xuất hàng" in text and "ĐÃ HỦY" in text
    assert "Sai số lượng" in text and replacement.code in text and "Đã được thay bằng" in text
    assert "Tạp hóa Hồng Phúc" in text and "204.000" in text

    html = client.get(f"/api/v1/documents/{replacement.id}/print")
    assert html.status_code == 200 and html.headers["content-type"].startswith("text/html")
    assert f"Thay thế cho:</strong> {issue.code}" in html.text
    payment = client.get(
        f"/api/v1/documents/{history.payment.id}/print", headers={"Accept": "application/pdf"}
    )
    assert payment.status_code == 200 and payment.content.startswith(b"%PDF-")
    assert (
        client.get(
            f"/api/v1/documents/{issue.id}/print", headers={"Accept": "image/png"}
        ).status_code
        == 406
    )
    # The revisionNo parameter is gone; unknown query parameters are ignored.
    assert client.get(f"/api/v1/documents/{issue.id}/print?revisionNo=1").status_code == 200


def test_missing_and_malformed_documents(login, history):
    client = login()
    for suffix in ("", "/chain", "/print"):
        missing = client.get(f"/api/v1/documents/999999{suffix}")
        assert missing.status_code == 404 and missing.json()["code"] == "NOT_FOUND"
        assert client.get(f"/api/v1/documents/abc{suffix}").status_code == 422
        assert client.get(f"/api/v1/documents/0{suffix}").status_code == 422
    # Revision and line routes were removed with document_revision.
    for path in ("/revisions", "/revisions/1", "/revisions/1/lines"):
        assert client.get(f"/api/v1/documents/{history.issue.id}{path}").status_code == 404


def test_permission_denials(login, users, history):
    guest = login(users.nobody)
    for path in (
        "/api/v1/documents",
        f"/api/v1/documents/{history.issue.id}",
        f"/api/v1/documents/{history.issue.id}/chain",
        f"/api/v1/documents/{history.issue.id}/print",
    ):
        assert guest.get(path).status_code == 403, path

    sales = login(users.sales)
    listed = sales.get("/api/v1/documents").json()["items"]
    assert {item["kind"] for item in listed} == {"STOCK_ISSUE", "PAYMENT_RECEIPT"}
    assert sales.get("/api/v1/documents", params={"kind": "STOCK_RECEIPT"}).status_code == 403
    for suffix in ("", "/chain", "/print"):
        response = sales.get(f"/api/v1/documents/{history.receipt.id}{suffix}")
        assert response.status_code == 403 and response.json()["code"] == "FORBIDDEN"
    assert sales.get(f"/api/v1/documents/{history.payment.id}").status_code == 200

    warehouse = login(users.warehouse)
    assert warehouse.get(f"/api/v1/documents/{history.payment.id}").status_code == 403
    assert warehouse.get(f"/api/v1/documents/{history.receipt.id}").status_code == 200


def test_unauthenticated_requests_are_rejected(login, history):
    client = login()
    del client.headers["Authorization"]
    response = client.get("/api/v1/documents")
    assert response.status_code == 401 and "WWW-Authenticate" in response.headers
