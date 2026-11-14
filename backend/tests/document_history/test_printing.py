from io import BytesIO
from unittest.mock import patch

import pytest
from pypdf import PdfReader
from reportlab.pdfbase import pdfmetrics

from app.core.exceptions import ApiError
from app.modules.document_history.printing import (
    FONT,
    amount_in_words,
    document_rows,
    negotiate,
    number,
    print_document,
    register_font,
)


@pytest.mark.parametrize(
    "accept,expected",
    [
        (None, "text/html"),
        ("", "text/html"),
        ("*/*", "text/html"),
        ("application/pdf", "application/pdf"),
        ("text/html;q=0,*/*;q=1", "application/pdf"),
        ("application/*;q=.8,text/html;q=.2", "application/pdf"),
        ("text/html;charset=utf-8", "text/html"),
        ("application/pdf;q=1,text/html;q=1", "text/html"),
    ],
)
def test_media_negotiation(accept, expected):
    assert negotiate(accept) == expected


@pytest.mark.parametrize(
    "accept",
    ["image/png", "text/html;q=0,application/pdf;q=0", "*/*;q=abc", "*/*;q=2", "*/*;q=-1"],
)
def test_unsupported_media(accept):
    with pytest.raises(ApiError) as error:
        negotiate(accept)
    assert error.value.status == 406 and error.value.code == "NOT_ACCEPTABLE"


@pytest.mark.parametrize(
    "value,expected",
    [
        ("0", "0"),
        ("999", "999"),
        ("1000", "1.000"),
        ("1250000", "1.250.000"),
        ("2.500", "2,5"),
        ("-3000.10", "-3.000,1"),
        ("12.000", "12"),
        ("not-a-number", "not-a-number"),
    ],
)
def test_number_uses_vietnamese_grouping(value, expected):
    assert number(value) == expected


def issue(**overrides):
    document = {
        "id": "7",
        "kind": "STOCK_ISSUE",
        "code": "PX-7",
        "status": "CANCELLED",
        "businessDate": "2026-11-03",
        "agencyId": "3",
        "agencyCode": "DL-003",
        "agencyName": "Đại lý Nguyễn Ánh <script>alert(1)</script>",
        "receiptType": None,
        "totalAmount": "1224000",
        "note": "https://evil.test/không-tải",
        "createdByName": "Nguyễn Thúy Ngân",
        "postedByName": "Huỳnh Gia Phúc",
        "cancelledByName": "Nguyễn Trần Thảo Nguyên",
        "cancelReason": "Giao sai số lượng",
        "replaces": {"id": "5", "code": "PX-5", "status": "CANCELLED"},
        "replacedBy": {"id": "9", "code": "PX-9", "status": "POSTED"},
        "lines": [
            {
                "lineNo": 1,
                "productName": "Sữa đậu nành Fami",
                "unitName": "Thùng",
                "quantity": "12",
                "unitPrice": "102000",
                "lineAmount": "1224000",
            }
        ],
    }
    document.update(overrides)
    return document


def pdf_text(content: bytes) -> str:
    return "\n".join(page.extract_text() for page in PdfReader(BytesIO(content)).pages)


def test_rows_of_a_cancelled_replaced_issue():
    title, metadata, rows = document_rows(issue())
    labels = dict(metadata)
    assert title == "Phiếu xuất hàng PX-7"
    assert labels["Trạng thái"] == "ĐÃ HỦY / CANCELLED"
    assert labels["Đại lý"].endswith("(DL-003)")
    assert labels["Tổng tiền (VNĐ)"] == "1.224.000"
    assert labels["Thay thế cho"] == "PX-5" and labels["Đã được thay bằng"] == "PX-9"
    assert labels["Lý do hủy"] == "Giao sai số lượng"
    assert labels["Người hủy"] == "Nguyễn Trần Thảo Nguyên"
    assert "Hình thức thu" not in labels
    assert rows == [[1, "Sữa đậu nành Fami", "Thùng", "12", "102.000", "1.224.000"]]


def test_rows_of_a_posted_payment_and_a_draft_receipt():
    payment = issue(
        kind="PAYMENT_RECEIPT",
        code="PT-8",
        status="POSTED",
        receiptType="BANK_TRANSFER",
        totalAmount="500000",
        replaces=None,
        replacedBy=None,
        cancelReason=None,
        cancelledByName=None,
        note=None,
        lines=[],
    )
    title, metadata, rows = document_rows(payment)
    labels = dict(metadata)
    assert title == "Phiếu thu tiền PT-8" and labels["Hình thức thu"] == "Chuyển khoản"
    assert labels["Trạng thái"] == "ĐÃ GHI SỔ / POSTED" and rows == []
    assert not {"Lý do hủy", "Thay thế cho", "Đã được thay bằng", "Ghi chú"} & set(labels)

    receipt = issue(
        kind="STOCK_RECEIPT",
        code="PN-2",
        status="DRAFT",
        agencyId=None,
        agencyCode=None,
        agencyName=None,
        postedByName=None,
        replaces=None,
        replacedBy=None,
    )
    title, metadata, _ = document_rows(receipt)
    labels = dict(metadata)
    assert title == "Phiếu nhập hàng PN-2" and labels["Trạng thái"] == "BẢN NHÁP / DRAFT"
    assert not {"Đại lý", "Người ghi sổ", "Lý do hủy"} & set(labels)


def test_html_escapes_and_pdf_contains_code_and_vietnamese_text():
    document = issue()
    with patch("urllib.request.urlopen", side_effect=AssertionError("No user URL fetching")):
        html, media, headers = print_document(document, None)
        assert media == "text/html" and b"<script>" not in html
        assert b"&lt;script&gt;" in html and "ĐÃ HỦY" in html.decode()
        assert 'filename="PX-7.html"' in headers["Content-Disposition"]
        assert "filename*=UTF-8''" in headers["Content-Disposition"]
        assert headers["Vary"] == "Accept" and headers["Cache-Control"] == "no-store"
        pdf, media, headers = print_document(document, "application/pdf")
    assert media == "application/pdf" and pdf.startswith(b"%PDF-")
    assert 'filename="PX-7.pdf"' in headers["Content-Disposition"]
    text = pdf_text(pdf)
    for expected in ("PX-7", "PX-5", "PX-9", "Sữa đậu nành Fami", "Giao sai số lượng", "1.224.000"):
        assert expected in text
    register_font()
    cmap = pdfmetrics.getFont(FONT).face.charToGlyph
    assert all(ord(char) in cmap for char in "Đại lý Nguyễn Ánh Sữa đậu nành Thay thế ĐÃ HỦY")


def test_payment_print_has_no_line_table():
    payment = issue(kind="PAYMENT_RECEIPT", code="PT-8", receiptType="CASH", lines=[])
    html, _, _ = print_document(payment, "text/html")
    assert b"<table>" not in html and "Tiền mặt" in html.decode()
    pdf, _, _ = print_document(payment, "application/pdf")
    text = pdf_text(pdf)
    assert "PT-8" in text and "Mặt hàng" not in text


def test_many_lines_wrap_across_pages_with_vietnamese_headers():
    document = issue(
        lines=[
            {**issue()["lines"][0], "lineNo": i, "productName": "Sữa đậu nành dài " * 8}
            for i in range(1, 61)
        ]
    )
    pdf, _, _ = print_document(document, "application/pdf")
    pages = PdfReader(BytesIO(pdf)).pages
    assert len(pages) > 2
    assert all(float(page.mediabox.width) == pytest.approx(595.2756, abs=0.01) for page in pages)
    assert all("Mặt hàng" in page.extract_text() for page in pages)
    assert "60" in pages[-1].extract_text()


def test_rows_tolerate_missing_optional_names():
    document = issue(agencyCode=None, createdByName=None, cancelledByName=None)
    _, metadata, _ = document_rows(document)
    labels = dict(metadata)
    assert labels["Đại lý"] == document["agencyName"]
    assert "Người lập" not in labels and "Người hủy" not in labels
    assert labels["Lý do hủy"] == "Giao sai số lượng"


@pytest.mark.parametrize(
    "value,expected",
    [
        (0, "Không đồng"),
        (5, "Năm đồng"),
        (10, "Mười đồng"),
        (15, "Mười lăm đồng"),
        (21, "Hai mươi mốt đồng"),
        (24, "Hai mươi tư đồng"),
        (105, "Một trăm lẻ năm đồng"),
        (110, "Một trăm mười đồng"),
        ("1250000", "Một triệu hai trăm năm mươi nghìn đồng"),
        (1005000, "Một triệu không trăm lẻ năm nghìn đồng"),
        (2000001, "Hai triệu không trăm lẻ một đồng"),
        ("10200.00", "Mười nghìn hai trăm đồng"),
        (1_000_000_000, "Một tỷ đồng"),
        (2_000_500_000, "Hai tỷ năm trăm nghìn đồng"),
        (1_000_000_000_000, "Một nghìn tỷ đồng"),
    ],
)
def test_amount_in_words(value, expected):
    assert amount_in_words(value) == expected


@pytest.mark.parametrize("value", [-1, "1.5", "abc", None])
def test_amount_in_words_rejects_non_whole_amounts(value):
    with pytest.raises(ValueError):
        amount_in_words(value)


def test_payment_receipt_has_amount_words_and_signature_lines():
    payment = issue(
        kind="PAYMENT_RECEIPT", code="PT-8", receiptType="CASH", totalAmount="1250000", lines=[]
    )
    labels = dict(document_rows(payment)[1])
    assert labels["Số tiền bằng chữ"] == "Một triệu hai trăm năm mươi nghìn đồng"
    html = print_document(payment, "text/html")[0].decode()
    assert "Người nộp tiền" in html and "Người thu tiền" in html
    text = pdf_text(print_document(payment, "application/pdf")[0])
    for expected in ("Một triệu hai trăm", "Người nộp tiền", "Người thu tiền", "Ký, ghi rõ"):
        assert expected in text
    goods = dict(document_rows(issue())[1])
    assert "Số tiền bằng chữ" not in goods
