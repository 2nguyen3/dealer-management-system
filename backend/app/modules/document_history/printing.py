"""Printable HTML/PDF of one simplified document (ReportLab with a bundled Vietnamese font).

The renderer only consumes an already authorized ``Document`` projection (JSON mode)
and never fetches user-supplied URLs.
"""

from decimal import Decimal, InvalidOperation
from html import escape
from io import BytesIO
from pathlib import Path
from threading import Lock
from urllib.parse import quote

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    LongTable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.exceptions import ApiError

FONT = "AgentraNotoSans"
FONT_PATH = Path(__file__).parent / "fonts" / "NotoSans-Regular.ttf"
FONT_LOCK = Lock()
TITLES = {
    "STOCK_RECEIPT": "Phiếu nhập hàng",
    "STOCK_ISSUE": "Phiếu xuất hàng",
    "PAYMENT_RECEIPT": "Phiếu thu tiền",
}
STATUSES = {
    "DRAFT": "BẢN NHÁP / DRAFT",
    "POSTED": "ĐÃ GHI SỔ / POSTED",
    "CANCELLED": "ĐÃ HỦY / CANCELLED",
}
RECEIPT_TYPES = {
    "CASH": "Tiền mặt",
    "BANK_TRANSFER": "Chuyển khoản",
    "ONLINE": "Thanh toán trực tuyến (VNPAY)",
}
HEADINGS = ["STT", "Mặt hàng", "ĐVT", "Số lượng", "Đơn giá", "Thành tiền"]
SIGNATURES = ("Người nộp tiền", "Người thu tiền")
SIGNATURE_HINT = "(Ký, ghi rõ họ tên)"
DIGITS = "không một hai ba bốn năm sáu bảy tám chín".split()


def negotiate(accept):
    """Pick text/html (default) or application/pdf from an Accept header, else 406."""
    if not accept:
        return "text/html"
    ranges = []
    for part in accept.split(","):
        tokens = [token.strip().lower() for token in part.split(";")]
        quality = 1.0
        for parameter in tokens[1:]:
            if parameter.startswith("q="):
                try:
                    quality = float(parameter[2:])
                except ValueError:
                    raise ApiError(406, "NOT_ACCEPTABLE", "Unsupported print format") from None
        if not 0 <= quality <= 1:
            raise ApiError(406, "NOT_ACCEPTABLE", "Unsupported print format")
        ranges.append((tokens[0], quality))
    candidates = []
    for media in ("text/html", "application/pdf"):
        family = media.split("/")[0] + "/*"
        matches = [
            (2 if value == media else 1 if value == family else 0, q)
            for value, q in ranges
            if value in (media, family, "*/*")
        ]
        if matches:
            specificity = max(match[0] for match in matches)
            quality = max(q for spec, q in matches if spec == specificity)
            if quality > 0:
                candidates.append((quality, media == "text/html", media))
    if not candidates:
        raise ApiError(406, "NOT_ACCEPTABLE", "Unsupported print format")
    return max(candidates)[2]


def number(value) -> str:
    """Vietnamese grouping: 1250000 -> 1.250.000, 2.5 -> 2,5."""
    try:
        amount = Decimal(str(value))
    except InvalidOperation:
        return str(value)
    sign = "-" if amount < 0 else ""
    whole, _, fraction = f"{abs(amount):f}".partition(".")
    fraction = fraction.rstrip("0")
    grouped = f"{int(whole):,}".replace(",", ".")
    return sign + grouped + ("," + fraction if fraction else "")


def _triple(value: int, full: bool) -> list[str]:
    """Words of a 0–999 group; ``full`` keeps "không trăm"/"lẻ" after a higher group."""
    hundreds, tens, units = value // 100, value // 10 % 10, value % 10
    words = []
    if full or hundreds:
        words += [DIGITS[hundreds], "trăm"]
    if tens == 0:
        if units and (full or hundreds):
            words.append("lẻ")
    elif tens == 1:
        words.append("mười")
    else:
        words += [DIGITS[tens], "mươi"]
    if units:
        if units == 1 and tens > 1:
            words.append("mốt")
        elif units == 5 and tens > 0:
            words.append("lăm")
        elif units == 4 and tens > 1:
            words.append("tư")
        else:
            words.append(DIGITS[units])
    return words


def _below_billion(value: int, full: bool) -> list[str]:
    words = []
    for unit, size in (("triệu", 10**6), ("nghìn", 10**3), ("", 1)):
        part = value // size % 1000
        if part:
            words += _triple(part, full)
            if unit:
                words.append(unit)
            full = True
    return words


def _spell(value: int) -> list[str]:
    if value == 0:
        return [DIGITS[0]]
    billions, rest = divmod(value, 10**9)
    if not billions:
        return _below_billion(rest, False)
    return _spell(billions) + ["tỷ"] + (_below_billion(rest, True) if rest else [])


def amount_in_words(value) -> str:
    """Vietnamese reading of a whole VND amount: 1250000 -> "Một triệu hai trăm năm mươi
    nghìn đồng". Non-integer or negative input is rejected rather than misread."""
    try:
        amount = Decimal(str(value))
    except InvalidOperation:
        raise ValueError("Amount must be a number") from None
    if amount < 0 or amount != amount.to_integral_value():
        raise ValueError("Amount must be a whole, non-negative VND value")
    text = " ".join(_spell(int(amount))) + " đồng"
    return text[0].upper() + text[1:]


def document_rows(document):
    """Title, labelled metadata and line rows of a ``Document`` JSON projection."""
    title = f"{TITLES[document['kind']]} {document['code']}"
    metadata = [
        ("Trạng thái", STATUSES[document["status"]]),
        ("Ngày chứng từ", document["businessDate"]),
    ]
    if document.get("agencyName"):
        agency = document["agencyName"]
        if document.get("agencyCode"):
            agency = f"{agency} ({document['agencyCode']})"
        metadata.append(("Đại lý", agency))
    if document.get("receiptType"):
        metadata.append(("Hình thức thu", RECEIPT_TYPES[document["receiptType"]]))
    metadata.append(("Tổng tiền (VNĐ)", number(document["totalAmount"])))
    if document["kind"] == "PAYMENT_RECEIPT":
        metadata.append(("Số tiền bằng chữ", amount_in_words(document["totalAmount"])))
    if document.get("note"):
        metadata.append(("Ghi chú", document["note"]))
    if document.get("createdByName"):
        metadata.append(("Người lập", document["createdByName"]))
    if document.get("postedByName"):
        metadata.append(("Người ghi sổ", document["postedByName"]))
    if document.get("replaces"):
        metadata.append(("Thay thế cho", document["replaces"]["code"]))
    if document.get("replacedBy"):
        metadata.append(("Đã được thay bằng", document["replacedBy"]["code"]))
    if document["status"] == "CANCELLED":
        if document.get("cancelledByName"):
            metadata.append(("Người hủy", document["cancelledByName"]))
        metadata.append(("Lý do hủy", document.get("cancelReason") or ""))
    rows = [
        [
            line["lineNo"],
            line["productName"],
            line["unitName"],
            number(line["quantity"]),
            number(line["unitPrice"]),
            number(line["lineAmount"]),
        ]
        for line in document.get("lines") or []
    ]
    return title, metadata, rows


def render_html(document) -> bytes:
    title, metadata, rows = document_rows(document)
    details = "".join(
        f"<p><strong>{escape(key)}:</strong> {escape(str(value))}</p>" for key, value in metadata
    )
    table = ""
    if document["kind"] == "PAYMENT_RECEIPT":
        table = (
            '<div class="signatures">'
            + "".join(
                f"<div><strong>{escape(role)}</strong><br><em>{escape(SIGNATURE_HINT)}</em></div>"
                for role in SIGNATURES
            )
            + "</div>"
        )
    else:
        header = "".join(f"<th>{escape(value)}</th>" for value in HEADINGS)
        cells = "".join(
            "<tr>" + "".join(f"<td>{escape(str(value))}</td>" for value in row) + "</tr>"
            for row in rows
        )
        table = f"<table><thead><tr>{header}</tr></thead><tbody>{cells}</tbody></table>"
    return (
        f'<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>{escape(title)}</title>'
        "<style>body{font-family:sans-serif;max-width:1000px;margin:2rem auto;"
        "padding:1rem;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;"
        "table-layout:fixed}td,th{border:1px solid #777;padding:6px}"
        "@media print{body{margin:0}thead{display:table-header-group}"
        "tr{break-inside:avoid}}.signatures{display:flex;justify-content:space-around;"
        "margin-top:2.5rem;min-height:8rem;text-align:center}</style></head>"
        f"<body><h1>{escape(title)}</h1>{details}{table}</body></html>"
    ).encode()


def register_font() -> None:
    with FONT_LOCK:
        if FONT not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(FONT, str(FONT_PATH)))


def page_footer(canvas, document) -> None:
    canvas.saveState()
    canvas.setFont(FONT, 8)
    canvas.drawRightString(A4[0] - 36, 22, f"Trang {document.page}")
    canvas.restoreState()


def render_pdf(document) -> bytes:
    register_font()
    output = BytesIO()
    title, metadata, rows = document_rows(document)
    style = ParagraphStyle("Agentra", fontName=FONT, fontSize=9, leading=14, splitLongWords=True)
    heading = ParagraphStyle("Heading", parent=style, fontSize=16, leading=22, spaceAfter=12)
    story = [Paragraph(escape(title), heading)]
    story.extend(
        Paragraph(f"{escape(key)}: {escape(str(value))}", style) for key, value in metadata
    )
    if document["kind"] == "PAYMENT_RECEIPT":
        story.append(Spacer(1, 28))
        centred = ParagraphStyle("Centred", parent=style, alignment=1)
        signatures = Table(
            [
                [Paragraph(escape(role), centred) for role in SIGNATURES],
                [Paragraph(escape(SIGNATURE_HINT), centred) for _ in SIGNATURES],
            ],
            colWidths=[260, 260],
            rowHeights=[16, 90],
            hAlign="CENTER",
        )
        signatures.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(signatures)
    else:
        story.append(Spacer(1, 14))
        data = [[Paragraph(value, style) for value in HEADINGS]]
        data += [[Paragraph(escape(str(value)), style) for value in row] for row in rows]
        table = LongTable(
            data, colWidths=[30, 160, 40, 65, 95, 105], repeatRows=1, hAlign="LEFT", splitInRow=1
        )
        table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eeeeee")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story.append(table)
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


def print_document(document, accept):
    """Return (content, media type, headers) for a ``Document`` JSON projection."""
    media = negotiate(accept)
    pdf = media == "application/pdf"
    content = render_pdf(document) if pdf else render_html(document)
    fallback = f"{document['code']}.{'pdf' if pdf else 'html'}"
    filename = "chứng-từ-" + fallback
    headers = {
        "Content-Disposition": (
            f"inline; filename=\"{fallback}\"; filename*=UTF-8''{quote(filename)}"
        ),
        "Vary": "Accept",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    }
    return content, media, headers
