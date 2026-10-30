"""Detached report exports. The caller authorizes, materializes and releases its session.

JSON is negotiated here but rendered by the router, not by ``render_report``.
XLSX Record/Part columns identify lossless continuations (concatenate each field's
parts in order). Numbered sheets continue the same logical table, including metadata.
"""

import re
from datetime import date, datetime
from decimal import Decimal
from html import escape
from io import BytesIO
from itertools import zip_longest
from urllib.parse import quote

import xlsxwriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    LongTable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    TableStyle,
)

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
        return output.getvalue()


def report_page_footer(canvas, document):
    canvas.saveState()
    canvas.setFont(FONT, 8)
    canvas.drawRightString(document.pagesize[0] - document.rightMargin, 20, f"Page {document.page}")
    canvas.restoreState()


def render_pdf(dataset):
    register_font()
    style = ParagraphStyle("Report", fontName=FONT, fontSize=8, leading=12, splitLongWords=True)
    heading = ParagraphStyle("ReportHeading", parent=style, fontSize=15, leading=20, spaceAfter=10)

    def paragraph(value):
        return Paragraph(escape(_text(value)).replace("\n", "<br/>"), style)

    story = [Paragraph(escape(dataset["title"]), heading)]
    story.extend(paragraph(f"{key}: {_text(value)}") for key, value in _metadata(dataset)[1:])
    story.append(Spacer(1, 12))
    columns = dataset["columns"]
    # Repeat identity in every wide-table group; physical continuations repeat it too.
    identity = IDENTITIES[dataset["kind"]]
    identity_column = next(column for column in columns if column[0] == identity)
    details = [column for column in columns if column[0] != identity]
    groups = [[identity_column] + details[start : start + 3] for start in range(0, len(details), 3)]
    if not groups:
        groups = [[identity_column]]
    width = landscape(A4)[0] - 72
    for group_number, group in enumerate(groups, 1):
        if group_number > 1:
            story.append(PageBreak())
        story.append(paragraph(f"{dataset['kind']} / Columns {group_number} / Full-filter rows"))
        data = [[paragraph(label) for label in ["Record", "Part"] + [label for _, label in group]]]
        for record, row in enumerate(dataset["rows"], 1):
            # Bound physical rows so page breaks never orphan text from its identity.
            chunks = [_chunks(row[key], 120, line_limit=8) for key, _ in group]
            for part, values in enumerate(zip_longest(*chunks, fillvalue=""), 1):
                values = list(values)
                if part > 1:
                    values[0] = _text(row[group[0][0]])
                data.append([paragraph(record), paragraph(part)] + [paragraph(v) for v in values])
        widths = [46, 30] + [(width - 76) / len(group)] * len(group)
        table = LongTable(data, colWidths=widths, repeatRows=1, hAlign="LEFT", splitInRow=0)
        table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eeeeee")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story.extend([table, Spacer(1, 12)])
    if dataset["totals"] is not None:
        story.append(paragraph("Full-filter totals"))
        story.extend(
            paragraph(f"{key}: {_text(value)}") for key, value in dataset["totals"].items()
        )
    with BytesIO() as output:
        SimpleDocTemplate(
            output,
            pagesize=landscape(A4),
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
            title=dataset["title"],
            author="Agentra",
        ).build(story, onFirstPage=report_page_footer, onLaterPages=report_page_footer)
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
