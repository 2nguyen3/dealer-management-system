"""Printable payment request ("Phiếu báo thanh toán") of one online payment.

A PENDING payment that can still be paid carries a QR code of its signed VNPAY
checkout URL so the agency can pay from the printed or downloaded page. It is not a
receipt: money is recorded only when VNPAY confirms, and the automatic payment
receipt (PT-…) is then printed through ``/documents/{id}/print``. The renderer only
consumes an already authorized ``OnlinePayment`` projection (JSON mode) and never
fetches the checkout URL.
"""

from datetime import UTC, datetime
from html import escape
from io import BytesIO
from urllib.parse import quote

from reportlab.graphics import renderSVG
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.modules.document_history.printing import (
    FONT,
    amount_in_words,
    negotiate,
    number,
    page_footer,
    register_font,
)
from app.modules.online_payments.vnpay import VN

TITLE = "Phiếu báo thanh toán"
STATUSES = {
    "PENDING": "ĐANG CHỜ THANH TOÁN",
    "SUCCESS": "ĐÃ THANH TOÁN",
    "FAILED": "THANH TOÁN KHÔNG THÀNH CÔNG",
    "EXPIRED": "ĐÃ HẾT HẠN",
}
PAY_HINT = (
    "Quét mã QR bằng ứng dụng ngân hàng hoặc ví điện tử hỗ trợ VNPAY, kiểm tra đúng số "
    "tiền và thanh toán trước hạn ghi trên phiếu."
)
NOT_RECEIPT = (
    "Phiếu này không phải biên lai. Khoản tiền chỉ được ghi nhận khi VNPAY xác nhận; "
    "khi đó hệ thống tự lập phiếu thu và trừ vào công nợ của đại lý."
)
QR_SIZE = 180


def moment(value) -> str:
    """ISO instant -> "dd/MM/yyyy HH:mm" in Vietnam time; blank when missing."""
    if not value:
        return ""
    return datetime.fromisoformat(str(value)).astimezone(VN).strftime("%d/%m/%Y %H:%M")


def payable_url(payment) -> str | None:
    url = payment.get("checkoutUrl")
    return url if payment["status"] == "PENDING" and url else None


def status_label(payment) -> str:
    """A PENDING payment past its deadline is shown as overdue, not as payable."""
    expires = payment.get("expiresAt")
    if (
        payment["status"] == "PENDING"
        and expires
        and datetime.fromisoformat(str(expires)) <= datetime.now(UTC)
    ):
        return "QUÁ HẠN THANH TOÁN"
    return STATUSES[payment["status"]]


def payment_rows(payment):
    """Title, labelled metadata and closing note of an ``OnlinePayment`` projection."""
    title = f"{TITLE} #{payment['id']}"
    agency = payment.get("agencyName") or f"#{payment['agencyId']}"
    if payment.get("agencyCode"):
        agency = f"{agency} ({payment['agencyCode']})"
    metadata = [
        ("Trạng thái", status_label(payment)),
        ("Đại lý", agency),
        ("Số tiền (VNĐ)", number(payment["amount"])),
        ("Số tiền bằng chữ", amount_in_words(payment["amount"])),
        ("Cổng thanh toán", payment.get("provider") or "VNPAY"),
        ("Mã tham chiếu", payment["merchantReference"]),
        ("Ngày lập", moment(payment.get("createdAt"))),
        ("Hạn thanh toán", moment(payment.get("expiresAt"))),
    ]
    if payment.get("paymentTime"):
        metadata.append(("Thời điểm thanh toán", moment(payment["paymentTime"])))
    if payment.get("receiptCode"):
        metadata.append(("Phiếu thu", payment["receiptCode"]))
    if payable_url(payment):
        note = PAY_HINT
    elif payment["status"] == "SUCCESS":
        note = "Đã nhận tiền. Biên lai chính thức là phiếu thu ghi ở trên."
    else:
        note = "Liên kết thanh toán không còn hiệu lực; vui lòng yêu cầu phiếu báo mới."
    return title, metadata, note


def qr_drawing(url: str, size: int = QR_SIZE) -> Drawing:
    widget = QrCodeWidget(url, barLevel="M")
    left, bottom, right, top = widget.getBounds()
    drawing = Drawing(
        size, size, transform=[size / (right - left), 0, 0, size / (top - bottom), 0, 0]
    )
    drawing.add(widget)
    return drawing


def render_html(payment) -> bytes:
    title, metadata, note = payment_rows(payment)
    details = "".join(
        f"<p><strong>{escape(key)}:</strong> {escape(str(value))}</p>" for key, value in metadata
    )
    url = payable_url(payment)
    qr = ""
    if url:
        svg = renderSVG.drawToString(qr_drawing(url))
        svg = svg[svg.index("<svg") :]  # drop the XML prolog/doctype inside HTML
        qr = (
            f'<figure class="qr">{svg}<figcaption>Quét để thanh toán qua VNPAY</figcaption>'
            f'</figure><p class="link"><a href="{escape(url)}" rel="noreferrer">'
            "Mở trang thanh toán</a></p>"
        )
    return (
        f'<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>{escape(title)}</title>'
        "<style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:1rem;"
        "overflow-wrap:anywhere}.qr{margin:1.5rem 0;text-align:center}.qr svg{background:#fff}"
        ".note{border-top:1px solid #777;margin-top:1.5rem;padding-top:.75rem;font-size:.9em}"
        "@media print{body{margin:0}.link{display:none}}</style></head>"
        f"<body><h1>{escape(title)}</h1>{details}{qr}<p>{escape(note)}</p>"
        f'<p class="note">{escape(NOT_RECEIPT)}</p></body></html>'
    ).encode()


def render_pdf(payment) -> bytes:
    register_font()
    output = BytesIO()
    title, metadata, note = payment_rows(payment)
    style = ParagraphStyle("Agentra", fontName=FONT, fontSize=10, leading=15, splitLongWords=True)
    heading = ParagraphStyle("Heading", parent=style, fontSize=16, leading=22, spaceAfter=12)
    centred = ParagraphStyle("Centred", parent=style, alignment=1, fontSize=9)
    story = [Paragraph(escape(title), heading)]
    story.extend(
        Paragraph(f"{escape(key)}: {escape(str(value))}", style) for key, value in metadata
    )
    url = payable_url(payment)
    if url:
        story.append(Spacer(1, 12))
        qr = Table(
            [[qr_drawing(url)], [Paragraph("Quét để thanh toán qua VNPAY", centred)]],
            hAlign="CENTER",
        )
        qr.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
        story.append(qr)
    story.append(Spacer(1, 12))
    story.append(Paragraph(escape(note), style))
    story.append(Spacer(1, 10))
    story.append(Paragraph(escape(NOT_RECEIPT), centred))
    SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
        title=title,
        author="Agentra",
    ).build(story, onFirstPage=page_footer, onLaterPages=page_footer)
    return output.getvalue()


def print_payment(payment, accept):
    """Return (content, media type, headers) for an ``OnlinePayment`` JSON projection."""
    media = negotiate(accept)
    pdf = media == "application/pdf"
    content = render_pdf(payment) if pdf else render_html(payment)
    fallback = f"payment-{payment['id']}.{'pdf' if pdf else 'html'}"
    filename = f"phiếu-báo-thanh-toán-{payment['id']}.{'pdf' if pdf else 'html'}"
    headers = {
        "Content-Disposition": (
            f"inline; filename=\"{fallback}\"; filename*=UTF-8''{quote(filename)}"
        ),
        "Vary": "Accept",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    }
    return content, media, headers
