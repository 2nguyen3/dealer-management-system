"""Payment request ("Phiếu báo thanh toán") rendering of an online payment projection."""

from datetime import UTC, datetime, timedelta
from io import BytesIO
from unittest.mock import patch

import pytest
from pypdf import PdfReader

from app.core.exceptions import ApiError
from app.modules.online_payments.printing import (
    moment,
    payable_url,
    payment_rows,
    print_payment,
    qr_drawing,
)

URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=VNPabc&vnp_Amount=25000000"


def projection(**values):
    now = datetime.now(UTC).replace(microsecond=0)
    return {
        "id": "7",
        "agencyId": "3",
        "agencyCode": "DL-3",
        "agencyName": "Tạp hóa Hồng Phúc <b>",
        "provider": "VNPAY",
        "merchantReference": "VNP" + "a" * 32,
        "providerTransactionId": None,
        "amount": "1250000",
        "status": "PENDING",
        "expiresAt": (now + timedelta(minutes=30)).isoformat(),
        "paymentTime": None,
        "receiptDocumentId": None,
        "receiptCode": None,
        "createdBy": "1",
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat(),
        "checkoutUrl": URL,
        **values,
    }


def pdf_text(content: bytes) -> str:
    return "\n".join(page.extract_text() for page in PdfReader(BytesIO(content)).pages)


def test_moment_uses_vietnam_time_and_tolerates_blank():
    assert moment("2026-11-14T03:00:00+00:00") == "14/11/2026 10:00"
    assert moment("2026-11-14T03:00:00Z") == "14/11/2026 10:00"
    assert moment(None) == "" and moment("") == ""


def test_pending_rows_carry_amount_words_deadline_and_pay_hint():
    title, metadata, note = payment_rows(projection())
    labels = dict(metadata)
    assert title == "Phiếu báo thanh toán #7"
    assert labels["Trạng thái"] == "ĐANG CHỜ THANH TOÁN"
    assert labels["Đại lý"] == "Tạp hóa Hồng Phúc <b> (DL-3)"
    assert labels["Số tiền (VNĐ)"] == "1.250.000"
    assert labels["Số tiền bằng chữ"] == "Một triệu hai trăm năm mươi nghìn đồng"
    assert labels["Hạn thanh toán"] == moment(projection()["expiresAt"])
    assert "Phiếu thu" not in labels and "Thời điểm thanh toán" not in labels
    assert note.startswith("Quét mã QR")
    assert payable_url(projection()) == URL


@pytest.mark.parametrize(
    "values,expected_status,note_start",
    [
        (
            {
                "status": "SUCCESS",
                "checkoutUrl": None,
                "paymentTime": "2026-11-14T04:15:00+00:00",
                "receiptDocumentId": "774",
                "receiptCode": "PT-774",
                "providerTransactionId": "14160000",
            },
            "ĐÃ THANH TOÁN",
            "Đã nhận tiền",
        ),
        ({"status": "EXPIRED", "checkoutUrl": None}, "ĐÃ HẾT HẠN", "Liên kết"),
        ({"status": "FAILED", "checkoutUrl": None}, "THANH TOÁN KHÔNG THÀNH CÔNG", "Liên kết"),
        # A stale URL on a terminal payment is never offered.
        ({"status": "EXPIRED"}, "ĐÃ HẾT HẠN", "Liên kết"),
    ],
)
def test_terminal_rows_offer_no_qr(values, expected_status, note_start):
    payment = projection(**values)
    _, metadata, note = payment_rows(payment)
    labels = dict(metadata)
    assert labels["Trạng thái"] == expected_status and note.startswith(note_start)
    assert payable_url(payment) is None
    if values["status"] == "SUCCESS":
        assert labels["Phiếu thu"] == "PT-774"
        assert labels["Thời điểm thanh toán"] == "14/11/2026 11:15"


def test_rows_fall_back_to_agency_id_without_names():
    _, metadata, _ = payment_rows(projection(agencyName="", agencyCode=""))
    assert dict(metadata)["Đại lý"] == "#3"


def test_qr_drawing_is_square_and_scaled():
    drawing = qr_drawing(URL, size=120)
    assert (drawing.width, drawing.height) == (120, 120)


def test_html_escapes_and_embeds_svg_qr_without_fetching():
    with patch("urllib.request.urlopen", side_effect=AssertionError("No URL fetching")):
        html, media, headers = print_payment(projection(), None)
    text = html.decode()
    assert media == "text/html" and "<svg" in text and "<?xml" not in text
    assert "&lt;b&gt;" in text and "<b>" not in text
    assert "Phiếu này không phải biên lai" in text
    assert 'filename="payment-7.html"' in headers["Content-Disposition"]
    assert headers["Vary"] == "Accept" and headers["Cache-Control"] == "no-store"
    terminal, _, _ = print_payment(projection(status="EXPIRED", checkoutUrl=None), "text/html")
    assert b"<svg" not in terminal and b"vpcpay" not in terminal


def test_pdf_contains_vietnamese_text_and_a_qr_only_when_payable():
    pdf, media, headers = print_payment(projection(), "application/pdf")
    assert media == "application/pdf" and pdf.startswith(b"%PDF-")
    assert 'filename="payment-7.pdf"' in headers["Content-Disposition"]
    text = pdf_text(pdf)
    for expected in ("Phiếu báo thanh toán #7", "1.250.000", "Hồng Phúc", "Quét để thanh toán"):
        assert expected in text
    assert len(PdfReader(BytesIO(pdf)).pages) == 1
    paid, _, _ = print_payment(
        projection(
            status="SUCCESS",
            checkoutUrl=None,
            paymentTime="2026-11-14T04:15:00+00:00",
            receiptCode="PT-774",
        ),
        "application/pdf",
    )
    paid_text = pdf_text(paid)
    assert "PT-774" in paid_text and "Quét để thanh toán" not in paid_text


def test_unsupported_media_is_rejected():
    with pytest.raises(ApiError) as caught:
        print_payment(projection(), "image/png")
    assert caught.value.status == 406


def test_overdue_pending_payment_is_labelled_overdue_without_qr():
    past = (datetime.now(UTC) - timedelta(minutes=1)).isoformat()
    payment = projection(expiresAt=past, checkoutUrl=None)
    _, metadata, note = payment_rows(payment)
    assert dict(metadata)["Trạng thái"] == "QUÁ HẠN THANH TOÁN"
    assert note.startswith("Liên kết") and payable_url(payment) is None
    # Still before the deadline: payable.
    assert dict(payment_rows(projection())[1])["Trạng thái"] == "ĐANG CHỜ THANH TOÁN"
