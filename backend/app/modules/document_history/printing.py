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
from reportlab.platypus import LongTable, Paragraph, SimpleDocTemplate, Spacer, TableStyle

from app.core.exceptions import ApiError

FONT = "AgentraNotoSans"
FONT_PATH = Path(__file__).parent / "fonts" / "NotoSans-Regular.ttf"
FONT_LOCK = Lock()
TITLES = {
    "STOCK_RECEIPT": "Phiếu nhập hàng",
    "STOCK_ISSUE": "Phiếu xuất hàng",
    "PAYMENT_RECEIPT": "Phiếu thu tiền",
    "STOCK_ADJUSTMENT": "Điều chỉnh kho",
    "SALES_RETURN": "Phiếu trả hàng",
    "CREDIT_APPLICATION": "Bù dư có",
    "REFUND": "Phiếu hoàn tiền",
}


def negotiate(accept):
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
        matches = [
            (2 if value == media else 1 if value == media.split("/")[0] + "/*" else 0, q)
            for value, q in ranges
            if value in (media, media.split("/")[0] + "/*", "*/*")
        ]
        if matches:
            specificity = max(match[0] for match in matches)
            quality = max(q for spec, q in matches if spec == specificity)
            if quality > 0:
                candidates.append((quality, media == "text/html", media))
    if not candidates:
        raise ApiError(406, "NOT_ACCEPTABLE", "Unsupported print format")
    return max(candidates)[2]


def snapshot_rows(document, revision):
    title = f"{TITLES[document['kind']]} {document['code']} — phiên bản {revision['revisionNo']}"
    label = (
        "ĐÃ HỦY / CANCELLED"
        if document["status"] == "CANCELLED"
        else (
            "BẢN NHÁP / DRAFT"
            if revision["state"] == "DRAFT"
            else "CHỜ XUẤT / READY"
            if revision["state"] == "READY"
            else "ĐÃ GHI SỔ / POSTED"
        )
    )
    metadata = [("Trạng thái", label), ("Ngày nghiệp vụ", revision["businessDate"])]
    agency = revision["agencySnapshot"]
    if agency is not None:
        metadata += [
            ("Đại lý", agency["name"]),
            ("Địa chỉ", agency["address"] or ""),
            ("Điện thoại", agency["phone"] or ""),
            ("Email", agency["email"]),
        ]
    metadata += [
        ("Tổng tiền (VNĐ)", revision["totalAmount"]),
        ("Trả ngay (VNĐ)", revision["immediatePayment"]),
    ]
    if document["kind"] == "STOCK_ISSUE":
        metadata.append(
            (
                "Còn lại lúc xuất (VNĐ)",
                str(int(revision["totalAmount"]) - int(revision["immediatePayment"])),
            )
        )
    if document["kind"] == "CREDIT_APPLICATION":
        metadata.append(("Tiền thu mới (VNĐ)", "0"))
    if revision["reason"]:
        metadata.append(("Lý do", revision["reason"]))
    if revision["note"]:
        metadata.append(("Ghi chú", revision["note"]))
    if document["status"] == "CANCELLED":
        metadata.append(("Lý do hủy", document["cancelReason"] or ""))
    rows = [
        [
            line["lineNo"],
            line["productName"],
            line["unitName"],
            line["quantity"],
            line["unitPrice"],
            line["lineAmount"],
        ]
        for line in revision["lines"]
    ]
    return title, metadata, rows


def render_html(document, revision):
    title, metadata, rows = snapshot_rows(document, revision)
    headings = ["STT", "Mặt hàng", "ĐVT", "Số lượng", "Đơn giá", "Thành tiền"]
    header = "".join(f"<th>{escape(value)}</th>" for value in headings)
    cells = "".join(
        "<tr>" + "".join(f"<td>{escape(str(value))}</td>" for value in row) + "</tr>"
        for row in rows
    )
    details = "".join(
        f"<p><strong>{escape(key)}:</strong> {escape(str(value))}</p>" for key, value in metadata
    )
    return (
        f'<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>{escape(title)}</title>'
        "<style>body{font-family:sans-serif;max-width:1000px;margin:2rem auto;"
        "padding:1rem;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;"
        "table-layout:fixed}td,th{border:1px solid #777;padding:6px}"
        "@media print{body{margin:0}thead{display:table-header-group}"
        "tr{break-inside:avoid}}</style></head>"
        f"<body><h1>{escape(title)}</h1>{details}<table><thead><tr>{header}</tr></thead>"
        f"<tbody>{cells}</tbody></table></body></html>"
    ).encode()


def register_font():
    with FONT_LOCK:
        if FONT not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(FONT, str(FONT_PATH)))


def page_footer(canvas, document):
    canvas.saveState()
    canvas.setFont(FONT, 8)
    canvas.drawRightString(A4[0] - 36, 22, f"Trang {document.page}")
    canvas.restoreState()


def render_pdf(document, revision):
    register_font()
    output = BytesIO()
    title, metadata, rows = snapshot_rows(document, revision)
    style = ParagraphStyle("Agentra", fontName=FONT, fontSize=9, leading=14, splitLongWords=True)
    heading = ParagraphStyle("Heading", parent=style, fontSize=16, leading=22, spaceAfter=12)
    story = [Paragraph(escape(title), heading)]
    story.extend(
        Paragraph(f"{escape(key)}: {escape(str(value))}", style) for key, value in metadata
    )
    story.append(Spacer(1, 14))
    data = [
        [
            Paragraph(value, style)
            for value in ["STT", "Mặt hàng", "ĐVT", "Số lượng", "Đơn giá", "Thành tiền"]
        ]
    ]
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


def print_snapshot(document, revision, accept):
    media = negotiate(accept)
    content = (
        render_pdf(document, revision)
        if media == "application/pdf"
        else render_html(document, revision)
    )
    extension = "pdf" if media == "application/pdf" else "html"
    fallback = f"{document['code']}-r{revision['revisionNo']}.{extension}"
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
