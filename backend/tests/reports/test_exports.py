import re
from copy import deepcopy
from datetime import UTC, date, datetime
from decimal import Decimal
from io import BytesIO
from unittest.mock import Mock
from xml.etree import ElementTree
from zipfile import ZipFile

import pytest
from pypdf import PdfReader
from reportlab.lib.pagesizes import A4, landscape

from app.core.exceptions import ApiError
from app.modules.reports import exporting as exports

XLSX = exports.XLSX_MEDIA
PDF = exports.PDF_MEDIA
JSON = exports.JSON_MEDIA
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
VIETNAMESE = "\u0110\u1ea1i l\u00fd Nguy\u1ec5n \u00c1nh"


def dataset(kind="sales", count=2):
    product = kind in ("inventory", "product-sales")
    identity = "productId" if product else "agencyId"
    name = "productName" if product else "agencyName"
    return {
        "kind": kind,
        "title": "Sales " + VIETNAMESE,
        "period": {
            "fromDate": date(2026, 1, 1),
            "toDate": "2026-02-01",
            "generatedAt": datetime(2026, 2, 1, 1, tzinfo=UTC),
        },
        "filters": {"agencyId": "9223372036854775807"},
        "columns": [
            (identity, "Product ID" if product else "Agency ID"),
            (name, "Product name" if product else "Agency name"),
            ("salesAmount", "Sales VND"),
            ("numberOfIssues", "Issue count"),
        ],
        "rows": [
            {
                identity: str(9223372036854775807 - index),
                name: VIETNAMESE,
                "salesAmount": "1234567890123456789012345678901234567890",
                "numberOfIssues": index,
            }
            for index in range(count)
        ],
        "totals": {"salesAmount": "9876543210987654321098765432109876543210", "numberOfIssues": 2},
    }


def workbook_rows(content):
    with ZipFile(BytesIO(content)) as archive:
        names = archive.namelist()
        assert not any("externalLinks" in name or "vbaProject" in name for name in names)
        strings = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
        shared = ["".join(item.itertext()) for item in strings]
        sheets = []
        for name in names:
            if not re.fullmatch(r"xl/worksheets/sheet\d+.xml", name):
                continue
            xml = ElementTree.fromstring(archive.read(name))
            assert xml.findall(".//s:f", NS) == []
            assert xml.findall(".//s:hyperlink", NS) == []
            rows = []
            for row in xml.findall(".//s:row", NS):
                cells = []
                for cell in row.findall("s:c", NS):
                    value = cell.findtext("s:v", namespaces=NS)
                    if cell.attrib.get("t") == "s":
                        value = shared[int(value)]
                    cells.append((cell.attrib.get("t"), value))
                rows.append(cells)
            sheets.append(rows)
        return sheets


@pytest.mark.parametrize(
    ("accept", "expected"),
    [
        (None, JSON),
        ("", JSON),
        ("*/*", JSON),
        ("application/*", JSON),
        (PDF, PDF),
        (XLSX, XLSX),
        (JSON, JSON),
        (f"{PDF};q=0.8,{XLSX};q=0.9", XLSX),
        (f"{PDF};q=0.9,{JSON};q=0.9", JSON),
        (f"{PDF};q=0.9,{XLSX};q=0.9", XLSX),
        (f"{PDF};q=0.5,application/*;q=0.5", PDF),
        (f"{JSON};q=0,*/*;q=1", XLSX),
        (f"{JSON};q=0,{XLSX};q=0,*/*", PDF),
        (f"application/*;q=0,*/*;q=1,{PDF};q=0.001", PDF),
        (f"{JSON};q=0.999,{PDF};q=1.000", PDF),
        (" Application/JSON ; charset=utf-8; Q = 1 ", JSON),
        (f"{JSON};q=0.2,{JSON};q=0.3,{PDF};q=0.25", JSON),
        (f"{PDF};q=0.,{XLSX};q=1.", XLSX),
        (f"text/html;q=1,{PDF};q=0.1", PDF),
    ],
)
def test_negotiate_report_media(accept, expected):
    assert exports.negotiate_report_media(accept) == expected


@pytest.mark.parametrize(
    "accept",
    [
        "text/html",
        "text/csv",
        "image/*",
        "*/*;q=0",
        f"{JSON};q=0,{XLSX};q=0,{PDF};q=0",
        f"{PDF};q=NaN",
        f"{PDF};q=Infinity",
        f"{PDF};q=-0.1",
        f"{PDF};q=1.001",
        f"{PDF};q=0.1234",
        f"{PDF};q=1e0",
        f"{PDF};q=.5",
        f"{PDF};q=",
        f"{PDF};q",
        f"{PDF};q=1;q=0",
        f'{PDF};q="0.5"',
        f"text/html;q=broken,{PDF}",
    ],
)
def test_negotiation_rejects_unacceptable_or_malformed_quality(accept):
    with pytest.raises(ApiError) as error:
        exports.negotiate_report_media(accept)
    assert (error.value.status, error.value.code) == (406, "NOT_ACCEPTABLE")
    assert "broken" not in error.value.message


@pytest.mark.parametrize("kind", sorted(exports.KINDS))
@pytest.mark.parametrize("media", [XLSX, PDF])
def test_every_report_all_rows_exact_values_and_security_headers(kind, media):
    source = dataset(kind, 105)
    identity = exports.IDENTITIES[kind]
    original = deepcopy(source)
    content, chosen, headers = exports.render_report(source, media)
    assert chosen == media
    assert headers == {
        "Content-Disposition": (
            f'attachment; filename="report-{kind}.{"xlsx" if media == XLSX else "pdf"}"; '
            f"filename*=UTF-8''report-{kind}.{'xlsx' if media == XLSX else 'pdf'}"
        ),
        "Vary": "Accept",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    }
    assert source == original
    if media == XLSX:
        sheets = workbook_rows(content)
        assert len(sheets[1]) == 106
        assert sheets[1][1][2] == ("s", source["rows"][0][identity])
        assert sheets[1][-1][2] == ("s", source["rows"][-1][identity])
        assert sheets[1][1][4] == ("s", source["rows"][0]["salesAmount"])
        assert sheets[2][1][2] == ("s", source["totals"]["salesAmount"])
    else:
        reader = PdfReader(BytesIO(content))
        assert len(reader.pages) > 1
        texts = [page.extract_text() for page in reader.pages]
        text = "\n".join(texts)
        assert VIETNAMESE in text
        assert source["rows"][-1][identity] in text
        assert source["rows"][0]["salesAmount"] in text.replace("\n", "")
        assert source["totals"]["salesAmount"] in text.replace("\n", "")
        assert "2026-02-01T01:00:00+00:00" in text
        assert "Filter agencyId" in text
        assert "historical period" in text
        assert sum(source["columns"][0][1] in page for page in texts) > 1
        for index, page in enumerate(reader.pages, 1):
            assert f"Page {index}" in page.extract_text()
            assert float(page.mediabox.width) == pytest.approx(landscape(A4)[0], abs=0.001)


@pytest.mark.parametrize("media", [XLSX, PDF])
def test_empty_inventory_without_totals_is_valid(media):
    source = dataset("inventory", 0)
    source["totals"] = None
    content, _, _ = exports.render_report(source, media)
    if media == XLSX:
        sheets = workbook_rows(content)
        assert len(sheets) == 2
        assert len(sheets[1]) == 1
    else:
        assert "Full-filter totals" not in PdfReader(BytesIO(content)).pages[0].extract_text()


def test_xlsx_injection_and_exact_numeric_policy_without_apostrophes():
    payloads = [
        "=SUM(A1:A2)",
        "+cmd",
        "-1+2",
        "@SUM(A1)",
        " =formula",
        "\t=tab",
        "\r=carriage",
        "\n=line",
        "=cmd|' /C calc'!A0",
        "https://evil.invalid/a?x=<bad>&y=1",
        "mailto:evil@invalid",
        "file:///etc/passwd",
        "\uff1dSUM(A1)",
        "<b>&name</b>",
        "_x000D_",
        "\u0110\u01a1n v\u1ecb l\u1ebb",
        "-123456789012345678901234567890",
        "0.001",
        "33.3333",
        "",
    ]
    source = dataset(count=len(payloads))
    for row, payload in zip(source["rows"], payloads, strict=True):
        row["agencyName"] = payload
    source["rows"][0]["numberOfIssues"] = 999999999999999
    source["rows"][1]["numberOfIssues"] = 1000000000000000
    source["rows"][2]["numberOfIssues"] = "2"
    source["rows"][3]["numberOfIssues"] = -1
    source["rows"][4]["numberOfIssues"] = True
    sheets = workbook_rows(exports.render_xlsx(source))
    for row, payload in zip(sheets[1][1:], payloads, strict=True):
        assert row[3][0] == "s"
        # OOXML escapes controls and protects literal escape-like strings.
        encoded = payload.replace("_x000D_", "_x005F_x000D_").replace("\r", "_x000D_")
        assert row[3][1] == encoded
    assert sheets[1][1][5] == (None, "999999999999999")
    assert sheets[1][2][5] == ("s", "1000000000000000")
    assert sheets[1][3][5] == ("s", "2")
    assert sheets[1][4][5] == ("s", "-1")
    assert sheets[1][5][5] == ("s", "True")


def test_xlsx_long_text_continuations_sheet_rollover_and_reconstruction(monkeypatch):
    monkeypatch.setattr(exports, "XLSX_ROWS", 4)
    source = dataset(count=3)
    long_name = "\U0001f600<&\n" * 14000
    source["rows"][0]["agencyName"] = long_name
    source["title"] = "t" * 33000
    source["totals"] = {"salesAmount": "9" * 33000}
    content = exports.render_xlsx(source)
    sheets = workbook_rows(content)
    row_sheets = [sheet for sheet in sheets if sheet[0][2][1] == "Agency ID"]
    physical = [row for sheet in row_sheets for row in sheet[1:]]
    assert len(row_sheets) >= 2
    first = [row for row in physical if row[0][1] == source["rows"][0]["agencyId"]]
    assert "".join(row[3][1] for row in first) == long_name
    assert [row[1][1] for row in first] == [str(i) for i in range(1, len(first) + 1)]
    assert all(len(row[3][1].encode("utf-16-le")) <= 64000 for row in first)
    assert all(row[3][1].count("\n") <= 250 for row in first)
    assert all(row[5] == ("s", "") for row in first[1:])
    assert {row[0][1] for row in physical} == {row["agencyId"] for row in source["rows"]}
    total_sheets = [sheet for sheet in sheets if sheet[0][2][1] == "salesAmount"]
    assert "".join(row[2][1] for sheet in total_sheets for row in sheet[1:]) == "9" * 33000


def test_xlsx_stable_identity_does_not_depend_on_column_order():
    source = dataset(count=1)
    source["rows"][0]["agencyName"] = "a" * 33000
    source["columns"] = source["columns"][1:] + source["columns"][:1]
    sheets = workbook_rows(exports.render_xlsx(source))
    assert len(sheets[1]) == 4
    assert {row[0][1] for row in sheets[1][1:]} == {source["rows"][0]["agencyId"]}
    assert "".join(row[2][1] for row in sheets[1][1:]) == "a" * 33000


def test_pdf_empty_names_and_large_exact_values():
    source = dataset(count=1)
    source["rows"][0]["agencyName"] = ""
    source["rows"][0]["salesAmount"] = "9" * 90
    content = exports.render_pdf(source)
    reader = PdfReader(BytesIO(content))
    text = "".join(page.extract_text() for page in reader.pages).replace("\n", "")
    assert "9" * 90 in text
    assert source["rows"][0]["agencyId"] in text


def test_pdf_newline_continuations_fit_pages_and_always_repeat_record_identity():
    source = dataset(count=1)
    source["rows"][0]["agencyName"] = "Continuation marker\n" * 100
    reader = PdfReader(BytesIO(exports.render_pdf(source)))
    texts = [page.extract_text() for page in reader.pages]
    assert len(texts) > 1
    assert sum(text.count("Continuation marker") for text in texts) == 100
    for text in texts:
        if "Continuation marker" in text:
            assert source["rows"][0]["agencyId"] in text
            assert "Agency ID" in text


def test_pdf_wide_groups_long_tokens_markup_and_single_column(tmp_path):
    source = dataset(count=1)
    source["rows"][0]["agencyName"] = "<img src='https://evil.invalid'>" + "X" * 1800
    for index in range(5):
        key = f"currentValue{index}"
        source["columns"].append((key, f"Current value {index}"))
        source["rows"][0][key] = "0.001"
    identity_column = source["columns"][0]
    source["columns"] = source["columns"][1:] + [identity_column]
    content = exports.render_pdf(source)
    (tmp_path / "wide-report.pdf").write_bytes(content)
    reader = PdfReader(BytesIO(content))
    text = "".join(page.extract_text() for page in reader.pages)
    assert len(reader.pages) >= 3
    assert "<img src='https://evil.invalid'>" in text
    assert sum(len(run) for run in re.findall("X{2,}", text)) == 1800
    assert all(source["rows"][0]["agencyId"] in page.extract_text() for page in reader.pages)
    assert not any(page.get("/Annots") for page in reader.pages)
    source["columns"] = [identity_column]
    assert "Agency ID" in PdfReader(BytesIO(exports.render_pdf(source))).pages[0].extract_text()


@pytest.mark.parametrize("media", [JSON, None, "*/*"])
def test_render_report_rejects_json_with_clear_caller_contract(media):
    with pytest.raises(ValueError, match="JSON reports must be rendered by the caller"):
        exports.render_report(dataset(), media)


@pytest.mark.parametrize("kind", ["../../bad", "sales\r\nX-Evil: true", "=SUM(A1)", "unknown"])
def test_unsafe_kind_rejected_before_renderer(kind, monkeypatch):
    renderer = Mock(side_effect=AssertionError("must not render"))
    monkeypatch.setattr(exports, "render_xlsx", renderer)
    with pytest.raises(ValueError, match="Unsupported report kind"):
        exports.render_report(dataset(kind), XLSX)
    renderer.assert_not_called()


def test_exact_scalar_formatting_and_float_rejection():
    assert exports._text(None) == ""
    assert exports._text(Decimal("1E+40")) == "1" + "0" * 40
    assert exports._text(Decimal("0.001")) == "0.001"
    assert exports._chunks("", 120) == [""]
    with pytest.raises(ValueError, match="not floats"):
        exports._text(0.1)


def test_landscape_footer_uses_actual_page_width_and_restores_canvas():
    canvas = Mock()
    document = Mock(pagesize=landscape(A4), rightMargin=36, page=7)
    exports.report_page_footer(canvas, document)
    canvas.drawRightString.assert_called_once_with(landscape(A4)[0] - 36, 20, "Page 7")
    canvas.saveState.assert_called_once()
    canvas.restoreState.assert_called_once()


@pytest.mark.parametrize("failure", ["xlsx-write", "xlsx-close", "pdf-build", "font"])
def test_render_failure_returns_no_partial_attachment_and_closes_memory(monkeypatch, failure):
    buffers = []

    def memory():
        buffer = BytesIO()
        buffers.append(buffer)
        return buffer

    monkeypatch.setattr(exports, "BytesIO", memory)
    if failure == "font":
        monkeypatch.setattr(exports, "register_font", Mock(side_effect=OSError("font failed")))
    elif failure == "pdf-build":
        monkeypatch.setattr(exports.SimpleDocTemplate, "build", Mock(side_effect=OSError("build")))
    elif failure == "xlsx-close":
        monkeypatch.setattr(
            exports.xlsxwriter.Workbook, "close", Mock(side_effect=OSError("close"))
        )
    else:
        import xlsxwriter.worksheet

        monkeypatch.setattr(xlsxwriter.worksheet.Worksheet, "write_string", Mock(return_value=-2))
    with pytest.raises((OSError, ValueError)):
        exports.render_report(dataset(), XLSX if failure.startswith("xlsx") else PDF)
    assert all(buffer.closed for buffer in buffers)


def test_xlsx_never_creates_temporary_files(monkeypatch):
    import tempfile

    monkeypatch.setattr(tempfile, "mkstemp", Mock(side_effect=AssertionError("disk not allowed")))
    assert exports.render_xlsx(dataset()).startswith(b"PK")
