from io import BytesIO
from unittest.mock import patch

import pytest
from pypdf import PdfReader
from reportlab.pdfbase import pdfmetrics

from app.core.exceptions import ApiError
from app.modules.document_history.printing import FONT, negotiate, print_snapshot, register_font


@pytest.mark.parametrize(
    "accept,expected",
    [
        (None, "text/html"),
        ("*/*", "text/html"),
        ("application/pdf", "application/pdf"),
        ("text/html;q=0,*/*;q=1", "application/pdf"),
        ("application/*;q=.8,text/html;q=.2", "application/pdf"),
        ("text/html;charset=utf-8", "text/html"),
    ],
)
def test_media_negotiation(accept, expected):
    assert negotiate(accept) == expected


@pytest.mark.parametrize(
    "accept",
    ["image/png", "text/html;q=0,application/pdf;q=0", "*/*;q=abc", "*/*;q=2", "*/*;q=nan"],
)
def test_unsupported_media(accept):
    with pytest.raises(ApiError, match="NOT_ACCEPTABLE"):
        negotiate(accept)


def snapshot():
    return {
        "kind": "STOCK_ISSUE",
        "code": "PX-1",
        "status": "CANCELLED",
        "cancelReason": "Sai chứng từ",
    }, {
        "revisionNo": 1,
        "state": "POSTED",
        "businessDate": "2026-01-01",
        "totalAmount": "102",
        "immediatePayment": "2",
        "agencySnapshot": {
            "name": "Đại lý Nguyễn Ánh <script>alert(1)</script>",
            "address": "Thành phố Hồ Chí Minh",
            "phone": None,
            "email": "a@example.com",
        },
        "reason": "Sửa sai",
        "note": "https://evil.test/không-tải",
        "lines": [
            {
                "lineNo": 1,
                "productName": "Sữa đậu nành",
                "unitName": "Hộp",
                "quantity": "1",
                "unitPrice": "102",
                "lineAmount": "102",
            }
        ],
    }


def test_html_escaping_pdf_glyphs_and_local_only_layout():
    document, revision = snapshot()
    with patch("urllib.request.urlopen", side_effect=AssertionError("No user URL fetching")):
        html, media, headers = print_snapshot(document, revision, None)
        assert media == "text/html" and b"<script>" not in html
        assert b"&lt;script&gt;" in html and "ĐÃ HỦY" in html.decode()
        assert "filename*=UTF-8''" in headers["Content-Disposition"]
        pdf, media, _ = print_snapshot(document, revision, "application/pdf")
        assert media == "application/pdf" and pdf.startswith(b"%PDF-")
        extracted = "\n".join(page.extract_text() for page in PdfReader(BytesIO(pdf)).pages)
        assert "Sữa đậu nành" in extracted and "Thành phố Hồ Chí Minh" in extracted
    register_font()
    cmap = pdfmetrics.getFont(FONT).face.charToGlyph
    assert all(ord(char) in cmap for char in "Đại lý Nguyễn Ánh Sữa đậu nành Thành phố Hồ Chí Minh")
    document["kind"] = "CREDIT_APPLICATION"
    document["status"] = "DRAFT"
    revision["state"] = "DRAFT"
    revision["agencySnapshot"] = None
    revision["lines"] = []
    revision["reason"] = revision["note"] = None
    html, _, _ = print_snapshot(document, revision, None)
    assert "BẢN NHÁP" in html.decode() and "Tiền thu mới" in html.decode()
    revision["state"] = "READY"
    html, _, _ = print_snapshot(document, revision, None)
    assert "CHỜ XUẤT" in html.decode()


def test_many_lines_wrap_across_pages_with_vietnamese_headers():
    document, revision = snapshot()
    revision["lines"] = [
        {**revision["lines"][0], "lineNo": i, "productName": "Sữa đậu nành dài " * 8}
        for i in range(1, 61)
    ]
    pdf, _, _ = print_snapshot(document, revision, "application/pdf")
    pages = PdfReader(BytesIO(pdf)).pages
    assert len(pages) > 2
    assert all(float(page.mediabox.width) == pytest.approx(595.2756, abs=0.01) for page in pages)
    assert all("Mặt hàng" in page.extract_text() for page in pages)
    assert "60" in pages[-1].extract_text()
