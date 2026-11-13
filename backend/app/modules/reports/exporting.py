"""Detached report exports. The caller authorizes, materializes and releases its session.

JSON is negotiated here but rendered by the router, not by ``render_report``.
XLSX Record/Part columns identify lossless continuations (concatenate each field's
parts in order). Numbered sheets continue the same logical table, including metadata.
"""

import re
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from html import escape
from io import BytesIO
from itertools import zip_longest
from pathlib import Path
from urllib.parse import quote

import xlsxwriter
from reportlab.graphics.charts.barcharts import HorizontalBarChart
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    CondPageBreak,
    Image,
    LongTable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.common.dates import VIETNAM
from app.core.exceptions import ApiError
from app.modules.document_history.printing import FONT, register_font

JSON_MEDIA = "application/json"
XLSX_MEDIA = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
PDF_MEDIA = "application/pdf"
MEDIA = (JSON_MEDIA, XLSX_MEDIA, PDF_MEDIA)
IDENTITIES = {
    "sales": "agencyId",
    "debt": "agencyId",
    "inventory": "productId",
    "product-sales": "productId",
    "cash-and-credit": "agencyId",
}
KINDS = set(IDENTITIES)
XLSX_ROWS = 1048576
COUNT_FIELDS = {"numberOfIssues"}

# Branding. Assets ship inside the package: Docker copies app/, Vercel lists them
# in vercel.json includeFiles next to the bundled NotoSans font.
ASSETS = Path(__file__).parent / "assets"
LOGO_PATH = ASSETS / "agentra-logo.png"
ICON_PATH = ASSETS / "agentra-icon.png"
LOGO_ASPECT = 234 / 320
BRAND_LINE = "Agentra · Hệ thống quản lý phân phối"
FILTER_LABELS = {
    "agencyId": "Đại lý (ID)",
    "productId": "Mặt hàng (ID)",
    "typeId": "Loại đại lý (ID)",
    "wardId": "Phường/xã (ID)",
}
NOTES = (
    "Tín dụng đầu kỳ/cuối kỳ tính theo kỳ báo cáo; các cột tín dụng hiện tại tính tại "
    "thời điểm lập báo cáo.",
    "Mã, số tiền, số lượng và tỷ lệ trong bảng là giá trị chính xác, không làm tròn; "
    "biểu đồ chỉ làm tròn để hiển thị.",
    "Giá trị dài được tách thành dòng tiếp nối (ví dụ 3.2), luôn lặp lại mã bản ghi.",
)

# Visual summary: KPI band plus top-N bar charts. Reports are per agency/product
# aggregates without a time dimension, so no trend chart is drawn.
PALETTE = ("#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948")
GRID_COLOR = "#e1e0d9"
AXIS_COLOR = "#898781"
CHART_TOP = 10
LABELLED_BARS = 3
LABEL_CHARS = 28
EMPTY_NOTE = "Không có dữ liệu"
SUMMARY_SHEET = "Tổng quan"
MONEY_FIELDS = {
    "salesAmount",
    "returnAmount",
    "netSalesAmount",
    "companyGrossSales",
    "openingDebt",
    "debtIncrease",
    "debtDecrease",
    "closingDebt",
    "cashReceived",
    "cashRefunded",
    "openingCredit",
    "closingCredit",
    "currentAvailableCredit",
}
FIELD_LABELS = {
    "salesAmount": "Doanh số bán",
    "returnAmount": "Hàng trả",
    "netSalesAmount": "Doanh số thuần",
    "companyGrossSales": "Doanh số toàn công ty",
    "numberOfIssues": "Số phiếu xuất",
    "openingDebt": "Nợ đầu kỳ",
    "debtIncrease": "Phát sinh tăng",
    "debtDecrease": "Giảm nợ",
    "closingDebt": "Nợ cuối kỳ",
    "openingStock": "Tồn đầu kỳ",
    "closingStock": "Tồn cuối kỳ",
    "receiptQuantity": "Nhập",
    "issueQuantity": "Xuất",
    "cashReceived": "Tiền thu",
    "cashRefunded": "Tiền hoàn",
    "openingCredit": "Tín dụng đầu kỳ",
    "closingCredit": "Tín dụng cuối kỳ",
    "currentAvailableCredit": "Tín dụng khả dụng hiện tại",
    "__rows": "Số mặt hàng",
    "__inStock": "Mặt hàng còn tồn",
    "__outOfStock": "Mặt hàng hết tồn",
}
VISUALS = {
    "sales": {
        "kpis": (
            "salesAmount",
            "returnAmount",
            "netSalesAmount",
            "numberOfIssues",
            "companyGrossSales",
        ),
        "charts": (
            ("Top đại lý theo doanh số thuần (VND)", ("netSalesAmount",)),
            ("Doanh số bán và hàng trả theo đại lý (VND)", ("salesAmount", "returnAmount")),
        ),
    },
    "debt": {
        "kpis": ("openingDebt", "debtIncrease", "debtDecrease", "closingDebt"),
        "charts": (
            ("Top đại lý theo nợ cuối kỳ (VND)", ("closingDebt",)),
            ("Nợ đầu kỳ và nợ cuối kỳ theo đại lý (VND)", ("openingDebt", "closingDebt")),
        ),
    },
    "inventory": {
        "kpis": ("__rows", "__inStock", "__outOfStock"),
        "charts": (
            ("Top mặt hàng theo tồn cuối kỳ (đơn vị của mặt hàng)", ("closingStock",)),
            ("Nhập và xuất trong kỳ theo mặt hàng", ("receiptQuantity", "issueQuantity")),
        ),
    },
    "product-sales": {
        "kpis": ("salesAmount", "returnAmount", "netSalesAmount", "__rows"),
        "charts": (
            ("Top mặt hàng theo doanh số thuần (VND)", ("netSalesAmount",)),
            ("Doanh số bán và hàng trả theo mặt hàng (VND)", ("salesAmount", "returnAmount")),
        ),
    },
    "cash-and-credit": {
        "kpis": ("cashReceived", "cashRefunded", "closingCredit", "currentAvailableCredit"),
        "charts": (
            ("Top đại lý theo tiền thu (VND)", ("cashReceived",)),
            ("Tín dụng đầu kỳ và cuối kỳ theo đại lý (VND)", ("openingCredit", "closingCredit")),
        ),
    },
}


def negotiate_report_media(accept):
    """Select quality, then specificity, then JSON/XLSX/PDF server preference."""
    if not accept:
        return JSON_MEDIA
    ranges = []
    for part in accept.split(","):
        tokens = [token.strip().lower() for token in part.split(";")]
        quality = Decimal(1)
        seen_quality = False
        for parameter in tokens[1:]:
            name, separator, value = parameter.partition("=")
            if name.strip() == "q":
                if (
                    seen_quality
                    or not separator
                    or not re.fullmatch(r"(?:0(?:\.[0-9]{0,3})?|1(?:\.0{0,3})?)", value.strip())
                ):
                    raise ApiError(406, "NOT_ACCEPTABLE", "Unsupported report format")
                quality = Decimal(value.strip())
                seen_quality = True
        ranges.append((tokens[0], quality))
    candidates = []
    for preference, media in enumerate(MEDIA):
        matches = [
            (2 if value == media else 1 if value == "application/*" else 0, quality)
            for value, quality in ranges
            if value in (media, "application/*", "*/*")
        ]
        if matches:
            specificity = max(spec for spec, _ in matches)
            quality = max(q for spec, q in matches if spec == specificity)
            if quality > 0:
                candidates.append((quality, specificity, -preference, media))
    if not candidates:
        raise ApiError(406, "NOT_ACCEPTABLE", "Unsupported report format")
    return max(candidates)[3]


def _text(value):
    if value is None:
        return ""
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, float):
        raise ValueError("Report scalars must be exact, not floats")
    return str(value)


def _metadata(dataset):
    return (
        [("Title", dataset["title"]), ("Kind", dataset["kind"])]
        + list(dataset["period"].items())
        + [("Filter " + key, value) for key, value in dataset["filters"].items()]
        + [
            ("Credit labels", "opening/closing: historical period; current fields: generatedAt"),
            ("Exact values", "IDs, amounts, quantities and percentages are text; no rounding"),
            ("Continuation", "XLSX: concatenate field Parts by Record; PDF: identity repeats"),
        ]
    )


def _business_date(value):
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    return date.fromisoformat(_text(value))


def _period_line(period):
    """Readable inclusive period; the API toDate is exclusive, so show the day before."""
    start = _business_date(period["fromDate"])
    end = _business_date(period["toDate"]) - timedelta(days=1)
    return f"Kỳ báo cáo: {start:%d/%m/%Y} – {end:%d/%m/%Y}"


def _generated_line(period):
    value = period["generatedAt"]
    moment = value if isinstance(value, datetime) else datetime.fromisoformat(_text(value))
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    return f"Lập lúc {moment.astimezone(VIETNAM):%H:%M %d/%m/%Y} (giờ Việt Nam)"


def _filter_line(filters):
    parts = [f"{FILTER_LABELS.get(key, key)} = {_text(value)}" for key, value in filters.items()]
    return "Bộ lọc: " + ("; ".join(parts) if parts else "tất cả")


def _chunks(value, size, line_limit=250):
    # 16000 code points also fit Excel's UTF-16 limit with supplementary glyphs.
    text = _text(value)
    parts = []
    start = 0
    newlines = 0
    for index, character in enumerate(text):
        newlines += character == "\n"
        if index - start + 1 == size or newlines == line_limit:
            parts.append(text[start : index + 1])
            start = index + 1
            newlines = 0
    if start < len(text) or not parts:
        parts.append(text[start:])
    return parts


def _number(value):
    """Exact Decimal for integral/decimal report scalars; None for anything else."""
    if type(value) is int:
        return Decimal(value)
    if isinstance(value, Decimal):
        return value
    if isinstance(value, str) and NUMBER.fullmatch(value):
        return Decimal(value)
    return None


def _grouped(value):
    """Exact Vietnamese grouping: 1.234.567,5 (no rounding)."""
    whole, _, fraction = format(abs(value), "f").partition(".")
    text = f"{int(whole):,}".replace(",", ".") + ("," + fraction if fraction else "")
    return "-" + text if value < 0 else text


def _compact(value):
    """Short axis/bar label (rounded for display only): 1,5 tỷ, 320 tr, 12 N."""
    magnitude = abs(value)
    if magnitude >= 1e15:
        return f"{value:.1e}".replace(".", ",")
    for scale, suffix in ((1e9, " tỷ"), (1e6, " tr"), (1e3, " N")):
        if magnitude >= scale:
            return f"{value / scale:.1f}".rstrip("0").rstrip(".").replace(".", ",") + suffix
    return f"{value:.2f}".rstrip("0").rstrip(".").replace(".", ",")


def _stock(row):
    return _number(row.get("closingStock"))


COUNTERS = {
    "__rows": lambda row: True,
    "__inStock": lambda row: (_stock(row) or 0) > 0,
    "__outOfStock": lambda row: _stock(row) is not None and _stock(row) <= 0,
}


def _field_label(key):
    return FIELD_LABELS[key] + (" (VND)" if key in MONEY_FIELDS else "")


def _kpis(dataset):
    """Key totals as (label, exact Decimal); fields absent from the dataset are skipped."""
    totals = dataset["totals"] or {}
    result = []
    for key in VISUALS[dataset["kind"]]["kpis"]:
        if key in COUNTERS:
            value = Decimal(sum(1 for row in dataset["rows"] if COUNTERS[key](row)))
        else:
            value = _number(totals.get(key))
        if value is not None:
            result.append((_field_label(key), value))
    return result


def _chart_label(kind, row):
    product = IDENTITIES[kind] == "productId"
    name = " ".join(_text(row.get("productName" if product else "agencyName")).split())
    label = name or _text(row.get(IDENTITIES[kind]))
    if len(label) > LABEL_CHARS:
        label = label[: LABEL_CHARS - 1] + "…"
    unit = " ".join(_text(row.get("unitName")).split())[:10]
    return f"{label} ({unit})" if product and unit else label


def _chart_rows(dataset, keys):
    """Top rows by the summed measures, positive values only; returns (top, total count)."""
    picked = []
    for row in dataset["rows"]:
        values = [_number(row.get(key)) for key in keys]
        if None in values or not any(value > 0 for value in values):
            continue
        picked.append((sum(values), _chart_label(dataset["kind"], row), values))
    picked.sort(key=lambda item: item[0], reverse=True)
    return [(label, values) for _, label, values in picked[:CHART_TOP]], len(picked)


def _chart_caption(shown, total):
    if total > shown:
        return f"Hiển thị {shown}/{total} dòng lớn nhất; các dòng còn lại có trong bảng chi tiết."
    return "Nhãn dài được rút gọn; giá trị chính xác có trong bảng chi tiết."


def _xlsx_summary(workbook, dataset):
    """Branded first-glance sheet: logo, headline, banded KPI cells and native bar charts."""
    sheet = workbook.add_worksheet(SUMMARY_SHEET)
    accent = "#1e3a5f"
    title = workbook.add_format({"bold": True, "font_size": 14, "font_color": accent})
    headline = workbook.add_format({"bold": True, "font_size": 20, "font_color": accent})
    subheadline = workbook.add_format({"font_size": 11, "font_color": "#1f2937"})
    brand = workbook.add_format({"font_size": 9, "font_color": AXIS_COLOR})
    section = workbook.add_format(
        {"bold": True, "font_size": 12, "font_color": accent, "bottom": 2, "bottom_color": accent}
    )
    muted = workbook.add_format({"italic": True, "font_color": AXIS_COLOR})
    head = workbook.add_format({"bold": True, "font_color": "#ffffff", "bg_color": accent})
    bands = []
    for fill in ("#ffffff", "#f3f5f8"):
        cell = {"bold": True, "bg_color": fill, "border": 1, "border_color": GRID_COLOR}
        bands.append(
            (
                workbook.add_format(cell),
                workbook.add_format({**cell, "num_format": "#,##0", "align": "right"}),
                workbook.add_format({**cell, "align": "right"}),
            )
        )
    sheet.set_column(0, 0, 34)
    sheet.set_column(1, 2, 22)
    sheet.hide_gridlines(2)

    def heading(row, text):
        sheet.write_string(row, 0, text, section)
        for column in range(1, 13):
            sheet.write_blank(row, column, None, section)

    # Rows 0-3 hold the logo (about 104x76 px); text follows below it.
    scale = 104 / 320
    sheet.insert_image(
        0, 0, str(LOGO_PATH), {"x_scale": scale, "y_scale": scale, "x_offset": 2, "y_offset": 2}
    )
    period = dataset["period"]
    sheet.write_string(4, 0, BRAND_LINE, brand)
    sheet.set_row(5, 30)
    sheet.write_string(5, 0, _text(dataset["title"])[:200], headline)
    sheet.write_string(6, 0, _period_line(period), subheadline)
    sheet.write_string(
        7, 0, f"{_filter_line(dataset['filters'])} · {_generated_line(period)}"[:500], muted
    )
    heading(9, "Chỉ số chính")
    sheet.write_row(10, 0, ["Chỉ số", "Giá trị"], head)
    kpis = _kpis(dataset)
    if not kpis:
        sheet.write_string(11, 0, EMPTY_NOTE, muted)
    for index, (label, value) in enumerate(kpis):
        text_format, number_format, exact_format = bands[index % 2]
        sheet.write_string(11 + index, 0, label, text_format)
        if value == value.to_integral_value() and abs(value) < 10**15:
            sheet.write_number(11 + index, 1, int(value), number_format)
        else:
            # Beyond Excel's 15 significant digits (or fractional): keep exact text.
            sheet.write_string(11 + index, 1, format(value, "f"), exact_format)
    heading(17, "Biểu đồ")
    axis_format = '[>=1000000000]#,##0.0,,," tỷ";[>=1000000]#,##0.0,," tr";#,##0'
    axis_font = {"color": AXIS_COLOR, "size": 8}
    row = 19
    for number, (chart_title, keys) in enumerate(VISUALS[dataset["kind"]]["charts"]):
        anchor = 19 + 18 * number
        top, total = _chart_rows(dataset, keys)
        sheet.write_string(row, 0, chart_title, head)
        sheet.write_row(row + 1, 0, ["Tên"] + [_field_label(key) for key in keys], head)
        if not top:
            sheet.write_string(row + 2, 0, EMPTY_NOTE, muted)
            sheet.write_string(anchor, 4, chart_title, title)
            sheet.write_string(anchor + 1, 4, EMPTY_NOTE, muted)
            row += 4
            continue
        first = row + 2
        for offset, (label, values) in enumerate(top):
            sheet.write_string(first + offset, 0, label)
            for column, value in enumerate(values, 1):
                sheet.write_number(first + offset, column, float(value))
        last = first + len(top) - 1
        sheet.write_string(last + 1, 0, _chart_caption(len(top), total), muted)
        chart = workbook.add_chart({"type": "bar"})
        for column, key in enumerate(keys, 1):
            series = {
                "name": _field_label(key),
                "categories": [SUMMARY_SHEET, first, 0, last, 0],
                "values": [SUMMARY_SHEET, first, column, last, column],
                "fill": {"color": PALETTE[column - 1]},
                "border": {"none": True},
                "gap": 60,
            }
            if len(keys) == 1:
                series["data_labels"] = {
                    "value": True,
                    "num_format": axis_format,
                    "font": {"color": "#1f2937", "size": 8},
                    "custom": [None] * min(len(top), LABELLED_BARS)
                    + [{"delete": True}] * max(len(top) - LABELLED_BARS, 0),
                }
            chart.add_series(series)
        chart.set_title({"name": chart_title, "name_font": {"size": 11, "bold": True}})
        # Bar charts: the y axis is the category axis; reverse so rank 1 is on top.
        chart.set_y_axis({"reverse": True, "num_font": axis_font, "line": {"none": True}})
        chart.set_x_axis(
            {
                "num_format": axis_format,
                "num_font": axis_font,
                "line": {"none": True},
                "major_gridlines": {"visible": True, "line": {"color": GRID_COLOR}},
            }
        )
        chart.set_legend({"none": True} if len(keys) == 1 else {"position": "top"})
        chart.set_chartarea({"border": {"none": True}})
        chart.set_size({"width": 640, "height": 330})
        sheet.insert_chart(anchor, 4, chart)
        row = last + 3
    sheet.activate()


def _xlsx_table(workbook, name, columns, records):
    sheet = None
    sheet_number = 0
    row_number = XLSX_ROWS
    for record, values in records:
        chunks = [_chunks(value, 16000) for value in values]
        for part, cells in enumerate(zip_longest(*chunks, fillvalue=""), 1):
            if row_number >= XLSX_ROWS:
                sheet_number += 1
                sheet = workbook.add_worksheet(f"{name} {sheet_number}")
                sheet.freeze_panes(1, 2)
                sheet.set_column(0, 1, 12)
                sheet.set_column(2, len(columns) + 1, 26)
                sheet.write_row(0, 0, ["Record", "Part"] + [label for _, label in columns])
                row_number = 1
            sheet.write_string(row_number, 0, _text(record))
            sheet.write_number(row_number, 1, part)
            for index, ((key, _), value, cell) in enumerate(
                zip(columns, values, cells, strict=True), 2
            ):
                if part == 1 and key in COUNT_FIELDS and type(value) is int and 0 <= value < 10**15:
                    result = sheet.write_number(row_number, index, value)
                else:
                    result = sheet.write_string(row_number, index, cell)
                if result != 0:
                    raise ValueError("Report workbook cell could not be written losslessly")
            row_number += 1
    if sheet is None:
        sheet = workbook.add_worksheet(f"{name} 1")
        sheet.write_row(0, 0, ["Record", "Part"] + [label for _, label in columns])


def render_xlsx(dataset):
    with BytesIO() as output:
        with xlsxwriter.Workbook(
            output,
            {"in_memory": True, "strings_to_formulas": False, "strings_to_urls": False},
        ) as workbook:
            _xlsx_table(
                workbook,
                "Metadata",
                [("field", "Field"), ("value", "Value")],
                ((index, pair) for index, pair in enumerate(_metadata(dataset), 1)),
            )
            columns = dataset["columns"]
            _xlsx_table(
                workbook,
                "Rows",
                columns,
                (
                    (row[IDENTITIES[dataset["kind"]]], [row[key] for key, _ in columns])
                    for row in dataset["rows"]
                ),
            )
            if dataset["totals"] is not None:
                totals = dataset["totals"]
                _xlsx_table(
                    workbook,
                    "Totals",
                    [(key, key) for key in totals],
                    [("Full-filter totals", list(totals.values()))],
                )
            # Appended last so data sheet positions stay stable; opened as active tab.
            _xlsx_summary(workbook, dataset)
        return output.getvalue()


INK = colors.HexColor("#1f2937")
MUTED = colors.HexColor("#6b7280")
ACCENT = colors.HexColor("#1e3a5f")
STRIPE = colors.HexColor("#f3f5f8")
RULE = colors.HexColor("#d5dae2")
NUMBER = re.compile(r"-?\d+(?:\.\d+)?")
INDEX_WIDTH = 34
PAGE_MARGIN = 36
TOP_MARGIN = 46
CHAR_WIDTH = 4.6
LOGO_HEIGHT = 58


def _clip(text, limit):
    return text if len(text) <= limit else text[: limit - 1] + "…"


def running_header(canvas, document, title):
    """Pages 2+: slim brand strip (icon + report title) above the frame."""
    top = document.pagesize[1]
    right = document.pagesize[0] - document.rightMargin
    canvas.saveState()
    canvas.drawImage(str(ICON_PATH), document.leftMargin, top - 35, 13, 13)
    canvas.setFont(FONT, 8.5)
    canvas.setFillColor(ACCENT)
    canvas.drawString(document.leftMargin + 18, top - 31, _clip(f"Agentra · {title}", 110))
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(document.leftMargin, top - 39, right, top - 39)
    canvas.restoreState()


def page_footer(canvas, left, total):
    """Every page: rule, report/generated line and "Agentra · Trang X/Y"."""
    width = canvas._pagesize[0]
    canvas.saveState()
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(PAGE_MARGIN, 30, width - PAGE_MARGIN, 30)
    canvas.setFont(FONT, 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(PAGE_MARGIN, 20, left)
    canvas.drawRightString(
        width - PAGE_MARGIN, 20, f"Agentra · Trang {canvas.getPageNumber()}/{total}"
    )
    canvas.restoreState()


def numbered_canvas(left):
    """Canvas class deferring footers until the total page count is known."""

    class NumberedCanvas(Canvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._pages = []

        def showPage(self):  # noqa: N802 - ReportLab API name
            self._pages.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            total = len(self._pages)
            for state in self._pages:
                self.__dict__.update(state)
                page_footer(self, left, total)
                Canvas.showPage(self)
            Canvas.save(self)

    return NumberedCanvas


def _ideal_width(label, values):
    """Preferred column width: widest header word or typical value, long values wrap."""
    word = max((len(part) for part in label.split()), default=1)
    longest = max((len(_text(value)) for value in values), default=0)
    return min(max(word, min(longest, 22)), 30) * CHAR_WIDTH + 12


def _column_groups(columns, identity, rows, available):
    """Pack columns into as few full-width tables as possible; each repeats the identity."""
    identity_column = next(column for column in columns if column[0] == identity)
    widths = {key: _ideal_width(label, [row[key] for row in rows]) for key, label in columns}
    groups = [[identity_column]]
    used = widths[identity]
    for column in (column for column in columns if column[0] != identity):
        if len(groups[-1]) > 1 and used + widths[column[0]] > available:
            groups.append([identity_column])
            used = widths[identity]
        groups[-1].append(column)
        used += widths[column[0]]
    return groups, widths


CHART_HEIGHT = 190
CHART_FONT_SIZE = 7
KPI_GAP = 8


def _fit(text, limit):
    """Shorten a chart label until it fits ``limit`` points at chart font size."""
    while len(text) > 1 and stringWidth(text, FONT, CHART_FONT_SIZE) > limit:
        text = text[:-2] + "…"
    return text


def _bar_drawing(top, keys, width):
    """Horizontal bars, rank 1 on top; one hue for one measure, legend for two."""
    grid = colors.HexColor(GRID_COLOR)
    axis = colors.HexColor(AXIS_COLOR)
    legend = 16 if len(keys) > 1 else 0
    label_limit = width * 0.4
    labels = [_fit(label, label_limit) for label, _ in top]
    data = [[float(values[index]) for _, values in top] for index in range(len(keys))]
    # Fixed band per category, so few rows give a shorter drawing, not fat bars.
    band = (CHART_HEIGHT - 16 - legend - 4) / CHART_TOP
    height = band * len(top) + 16 + legend + 4
    drawing = Drawing(width, height)
    chart = HorizontalBarChart()
    chart.x = max(stringWidth(label, FONT, CHART_FONT_SIZE) for label in labels) + 8
    chart.y = 16
    chart.width = width - chart.x - 48
    chart.height = band * len(top)
    # Reversed categories also flip in-group order; reverse series so the first
    # measure sits on top, matching the legend order.
    chart.data = data[::-1]
    chart.barWidth = 10
    chart.barSpacing = 1
    chart.groupSpacing = 6
    chart.bars.strokeColor = None
    for index in range(len(keys)):
        chart.bars[index].fillColor = colors.HexColor(PALETTE[len(keys) - 1 - index])
    category = chart.categoryAxis
    category.categoryNames = labels
    category.reverseDirection = 1
    category.visibleTicks = 0
    category.strokeColor = grid
    category.labels.fontName = FONT
    category.labels.fontSize = CHART_FONT_SIZE
    category.labels.fillColor = axis
    category.labels.boxAnchor = "e"
    category.labels.dx = -4
    value = chart.valueAxis
    value.forceZero = 1
    value.maximumTicks = 5
    value.labelTextFormat = _compact
    value.visibleTicks = 0
    value.strokeColor = grid
    value.visibleGrid = 1
    value.gridStrokeColor = grid
    value.gridStrokeWidth = 0.5
    value.labels.fontName = FONT
    value.labels.fontSize = CHART_FONT_SIZE
    value.labels.fillColor = axis
    if len(keys) == 1:
        chart.barLabelFormat = "values"
        chart.barLabelArray = [
            [_compact(item) if rank < LABELLED_BARS else None for rank, item in enumerate(data[0])]
        ]
        chart.barLabels.fontName = FONT
        chart.barLabels.fontSize = CHART_FONT_SIZE
        chart.barLabels.fillColor = INK
        chart.barLabels.boxAnchor = "w"
        chart.barLabels.dx = 3
    drawing.add(chart)
    x = chart.x
    for index, key in enumerate(keys if legend else ()):
        text = _field_label(key)
        drawing.add(
            Rect(
                x,
                height - 10,
                8,
                8,
                fillColor=colors.HexColor(PALETTE[index]),
                strokeColor=None,
            )
        )
        drawing.add(
            String(
                x + 11,
                height - 9,
                text,
                fontName=FONT,
                fontSize=CHART_FONT_SIZE,
                fillColor=INK,
            )
        )
        x += 11 + stringWidth(text, FONT, CHART_FONT_SIZE) + 14
    return drawing


def _pdf_visuals(dataset, width, paragraph, styles):
    """KPI band and the chart row placed between the header and the detailed table."""
    story = []
    kpis = _kpis(dataset)
    if kpis:
        story += [CondPageBreak(90), paragraph("Chỉ số chính", styles["section"])]
        box = (width - KPI_GAP * (len(kpis) - 1)) / len(kpis)
        cells, widths, commands = [], [], [("VALIGN", (0, 0), (-1, -1), "TOP")]
        for index, (label, value) in enumerate(kpis):
            if index:
                cells.append("")
                widths.append(KPI_GAP)
            column = len(cells)
            text = _grouped(value)
            # Exact values too wide for the box wrap at a smaller size, never overlap.
            fits = stringWidth(text, FONT, styles["kpi"].fontSize) <= box - 16
            value_style = styles["kpi"] if fits else styles["kpi_small"]
            cells.append([paragraph(label, styles["kpi_label"]), paragraph(text, value_style)])
            widths.append(box)
            commands += [
                ("BACKGROUND", (column, 0), (column, 0), STRIPE),
                ("BOX", (column, 0), (column, 0), 0.5, RULE),
                ("LINEABOVE", (column, 0), (column, 0), 2, colors.HexColor(PALETTE[0])),
                ("LEFTPADDING", (column, 0), (column, 0), 8),
                ("TOPPADDING", (column, 0), (column, 0), 6),
                ("BOTTOMPADDING", (column, 0), (column, 0), 6),
            ]
        band = Table([cells], colWidths=widths, hAlign="LEFT")
        band.setStyle(TableStyle(commands))
        story.extend([band, Spacer(1, 12)])
    story += [CondPageBreak(240), paragraph("Biểu đồ", styles["section"])]
    half = width / 2
    cells = []
    for chart_title, keys in VISUALS[dataset["kind"]]["charts"]:
        top, total = _chart_rows(dataset, keys)
        cell = [paragraph(chart_title, styles["chart_title"])]
        if top:
            cell += [
                _bar_drawing(top, keys, half - 16),
                paragraph(_chart_caption(len(top), total), styles["muted"]),
            ]
        else:
            cell.append(paragraph(EMPTY_NOTE, styles["muted"]))
        cells.append(cell)
    charts = Table([cells], colWidths=[half, half], hAlign="LEFT")
    charts.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("LEFTPADDING", (1, 0), (1, 0), 16),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("LINEBELOW", (0, 0), (-1, 0), 0.4, RULE),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.extend([charts, Spacer(1, 12)])
    return story


def render_pdf(dataset):
    register_font()
    style = ParagraphStyle("Report", fontName=FONT, fontSize=8, leading=11, textColor=INK)
    number = ParagraphStyle("ReportNumber", parent=style, alignment=2)
    head = ParagraphStyle("ReportHead", parent=style, textColor=colors.white)
    head_number = ParagraphStyle("ReportHeadNumber", parent=head, alignment=2)
    muted = ParagraphStyle("ReportMuted", parent=style, fontSize=7, leading=10, textColor=MUTED)
    heading = ParagraphStyle(
        "ReportHeading",
        parent=style,
        fontSize=22,
        leading=28,
        textColor=ACCENT,
        spaceBefore=4,
        spaceAfter=2,
    )
    subheading = ParagraphStyle("ReportSubheading", parent=style, fontSize=10.5, leading=15)
    section = ParagraphStyle(
        "ReportSection",
        parent=style,
        fontSize=12,
        leading=16,
        textColor=ACCENT,
        spaceBefore=4,
        spaceAfter=6,
    )
    group_heading = ParagraphStyle(
        "ReportGroup", parent=section, fontSize=9, leading=13, spaceBefore=2, spaceAfter=4
    )

    def paragraph(value, paragraph_style=style):
        return Paragraph(escape(_text(value)).replace("\n", "<br/>"), paragraph_style)

    columns = dataset["columns"]
    rows = dataset["rows"]
    identity = IDENTITIES[dataset["kind"]]
    width = landscape(A4)[0] - 2 * PAGE_MARGIN

    logo = Image(str(LOGO_PATH), width=LOGO_HEIGHT / LOGO_ASPECT, height=LOGO_HEIGHT)
    period = dataset["period"]
    banner = Table(
        [
            [
                logo,
                [
                    paragraph(BRAND_LINE, muted),
                    Paragraph(escape(dataset["title"]), heading),
                    paragraph(_period_line(period), subheading),
                    paragraph(
                        f"{_filter_line(dataset['filters'])} · {_generated_line(period)}", muted
                    ),
                ],
            ]
        ],
        colWidths=[logo.drawWidth + 16, width - logo.drawWidth - 16],
        hAlign="LEFT",
    )
    banner.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LINEBELOW", (0, 0), (-1, 0), 1.2, ACCENT),
            ]
        )
    )
    story = [banner, Spacer(1, 8)]
    styles = {
        "section": section,
        "muted": muted,
        "kpi_label": ParagraphStyle("ReportKpiLabel", parent=muted, fontSize=7.5),
        "kpi": ParagraphStyle(
            "ReportKpi", parent=style, fontSize=13, leading=18, textColor=ACCENT, spaceBefore=2
        ),
        "kpi_small": ParagraphStyle(
            "ReportKpiSmall", parent=style, fontSize=8, leading=12, textColor=ACCENT, spaceBefore=2
        ),
        "chart_title": ParagraphStyle(
            "ReportChartTitle", parent=style, fontSize=9, leading=12, spaceAfter=4
        ),
    }
    story.extend(_pdf_visuals(dataset, width, paragraph, styles))

    # Headings use CondPageBreak, not keepWithNext: KeepTogether would push a whole
    # long table to a fresh page instead of letting it start here.
    story += [CondPageBreak(96), paragraph("Chi tiết số liệu", section)]
    groups, ideal = _column_groups(columns, identity, rows, width - INDEX_WIDTH)
    numeric = {
        key
        for key, _ in columns
        if key != identity
        and rows
        and all(NUMBER.fullmatch(_text(row[key])) and len(_text(row[key])) <= 20 for row in rows)
    }
    for group_number, group in enumerate(groups, 1):
        if len(groups) > 1:
            story.append(paragraph(f"Nhóm cột {group_number}/{len(groups)}", group_heading))
        header = [paragraph("#", head)] + [
            paragraph(label, head_number if key in numeric else head) for key, label in group
        ]
        data = [header]
        for record, row in enumerate(rows, 1):
            # Bound physical rows so page breaks never orphan text from its identity.
            chunks = [_chunks(row[key], 120, line_limit=8) for key, _ in group]
            for part, values in enumerate(zip_longest(*chunks, fillvalue=""), 1):
                values = list(values)
                if part > 1:
                    values[0] = _text(row[group[0][0]])
                data.append(
                    [paragraph(record if part == 1 else f"{record}.{part}", muted)]
                    + [
                        paragraph(value, number if key in numeric else style)
                        for (key, _), value in zip(group, values, strict=True)
                    ]
                )
        total = sum(ideal[key] for key, _ in group)
        scale = min((width - INDEX_WIDTH) / total, 1.8)
        widths = [INDEX_WIDTH] + [ideal[key] * scale for key, _ in group]
        table = LongTable(data, colWidths=widths, repeatRows=1, hAlign="LEFT", splitInRow=0)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, STRIPE]),
                    ("LINEBELOW", (0, 1), (-1, -1), 0.25, RULE),
                    ("BOX", (0, 0), (-1, -1), 0.5, RULE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.extend([table, Spacer(1, 14)])
    if dataset["totals"] is not None:
        # Full-filter totals: readable label (field key kept for traceability), exact value.
        story += [
            CondPageBreak(80),
            paragraph("Tổng cộng (toàn bộ dữ liệu theo bộ lọc)", section),
        ]
        labels = dict(columns)
        totals = Table(
            [
                [
                    paragraph(labels.get(key) or FIELD_LABELS.get(key, key)),
                    paragraph(key, muted),
                    paragraph(value, number),
                ]
                for key, value in dataset["totals"].items()
            ],
            colWidths=[220, 150, 260],
            hAlign="LEFT",
        )
        totals.setStyle(
            TableStyle(
                [
                    ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, STRIPE]),
                    ("BOX", (0, 0), (-1, -1), 0.5, RULE),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.25, RULE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.extend([totals, Spacer(1, 10)])
    story += [CondPageBreak(70), paragraph("Ghi chú", section)]
    story.extend(paragraph(f"• {note}", muted) for note in NOTES)
    with BytesIO() as output:
        SimpleDocTemplate(
            output,
            pagesize=landscape(A4),
            rightMargin=PAGE_MARGIN,
            leftMargin=PAGE_MARGIN,
            topMargin=TOP_MARGIN,
            bottomMargin=PAGE_MARGIN + 4,
            title=dataset["title"],
            author="Agentra",
        ).build(
            story,
            onLaterPages=lambda canvas, document: running_header(
                canvas, document, dataset["title"]
            ),
            canvasmaker=numbered_canvas(
                _clip(f"{dataset['title']} · {_generated_line(dataset['period'])}", 120)
            ),
        )
        return output.getvalue()


def render_report(dataset, accept):
    """Render binary Accept only; JSON selection is a caller error (ValueError).

    Dataset is the validated detached projection, not a Session or a JSON page.
    Exceptions propagate before attachment bytes/headers are returned; API error
    plumbing owns safe 500 conversion. No temporary files or cleanup callbacks exist.
    """
    media = negotiate_report_media(accept)
    if media == JSON_MEDIA:
        raise ValueError("JSON reports must be rendered by the caller")
    kind = dataset["kind"]
    if kind not in KINDS:
        raise ValueError("Unsupported report kind")
    extension = "xlsx" if media == XLSX_MEDIA else "pdf"
    fallback = f"report-{kind}.{extension}"
    headers = {
        "Content-Disposition": (
            f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(fallback)}"
        ),
        "Vary": "Accept",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    }
    content = render_xlsx(dataset) if media == XLSX_MEDIA else render_pdf(dataset)
    return content, media, headers
