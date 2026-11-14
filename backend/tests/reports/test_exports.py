import re
from io import BytesIO
from zipfile import ZipFile

import pytest
from pypdf import PdfReader

from app.core.exceptions import ApiError
from app.modules.reports import exporting as exports
from app.modules.reports.service import REPORTS
from tests.reports.test_schemas import END, START, example_row
from tests.reports.test_service import service_with_rows

HEADINGS = {
    "sales": ("Báo cáo doanh số tháng", "Tỷ lệ (%)", "306000"),
    "debt": ("Báo cáo công nợ tháng", "Nợ đầu kỳ", "-48000"),
    "inventory": ("Báo cáo tồn kho", "Tồn cuối kỳ", "99.5"),
    "product-sales": ("Báo cáo doanh số theo mặt hàng", "SL bán", "30600"),
    "collections": ("Báo cáo thu tiền", "Chuyển khoản", "150000"),
}


def dataset(kind, count=3):
    rows = [example_row(kind, str(index)) for index in range(1, count + 1)]
    return service_with_rows(kind, rows).read(kind, START, END, export=True)


def xlsx_strings(content):
    with ZipFile(BytesIO(content)) as archive:
        names = archive.namelist()
        strings = archive.read("xl/sharedStrings.xml").decode("utf-8")
        workbook = archive.read("xl/workbook.xml").decode("utf-8")
    return names, strings, re.findall(r'<sheet name="([^"]+)"', workbook)


def pdf_text(content):
    return "".join(page.extract_text() for page in PdfReader(BytesIO(content)).pages)


@pytest.mark.parametrize(
    ("accept", "expected"),
    [
        (None, exports.JSON_MEDIA),
        ("", exports.JSON_MEDIA),
        ("*/*", exports.JSON_MEDIA),
        ("application/pdf", exports.PDF_MEDIA),
        (exports.XLSX_MEDIA, exports.XLSX_MEDIA),
        ("application/json;q=0.5, application/pdf", exports.PDF_MEDIA),
        ("application/*;q=0.9, application/pdf;q=0", exports.JSON_MEDIA),
        ("application/pdf;q=1.000", exports.PDF_MEDIA),
    ],
)
def test_negotiate_report_media(accept, expected):
    assert exports.negotiate_report_media(accept) == expected


@pytest.mark.parametrize(
    "accept",
    ["text/html", "application/pdf;q=0", "application/pdf;q=2", "application/pdf;q=0.5;q=0.6"],
)
def test_negotiation_rejects_unacceptable_or_malformed(accept):
    with pytest.raises(ApiError) as error:
        exports.negotiate_report_media(accept)
    assert (error.value.status, error.value.code) == (406, "NOT_ACCEPTABLE")


@pytest.mark.parametrize("kind", REPORTS)
def test_xlsx_contains_title_headings_and_exact_values(kind):
    content, media, headers = exports.render_report(dataset(kind), exports.XLSX_MEDIA)
    assert media == exports.XLSX_MEDIA
    assert headers["Content-Disposition"].startswith(f'attachment; filename="report-{kind}.xlsx"')
    assert headers["Cache-Control"] == "no-store" and headers["Vary"] == "Accept"
    names, strings, sheets = xlsx_strings(content)
    assert any(name.startswith("xl/charts/") for name in names)
    title, heading, value = HEADINGS[kind]
    assert title in strings and heading in strings and value in strings
    expected = ["Metadata 1", "Rows 1", "Tổng quan"]
    if REPORTS[kind].totals is not None:
        expected.insert(2, "Totals 1")
    assert sheets == expected


@pytest.mark.parametrize("kind", REPORTS)
def test_pdf_contains_title_headings_and_exact_values(kind):
    content, media, headers = exports.render_report(dataset(kind), exports.PDF_MEDIA)
    assert media == exports.PDF_MEDIA and content.startswith(b"%PDF")
    assert 'filename="report-' + kind + '.pdf"' in headers["Content-Disposition"]
    text = pdf_text(content)
    title, heading, value = HEADINGS[kind]
    assert title in text and heading in text and value in text
    assert "Kỳ báo cáo: 01/10/2026 – 31/10/2026" in text
    assert "phiếu nháp và phiếu đã hủy không được tính" in text


@pytest.mark.parametrize("kind", REPORTS)
@pytest.mark.parametrize("media", [exports.XLSX_MEDIA, exports.PDF_MEDIA])
def test_empty_reports_render(kind, media):
    content, chosen, _ = exports.render_report(dataset(kind, 0), media)
    assert chosen == media and content
    if media == exports.PDF_MEDIA:
        assert exports.EMPTY_NOTE in pdf_text(content)


def test_collections_charts_use_dates_and_three_receipt_types():
    data = dataset("collections")
    top, total = exports._chart_rows(data, ("cashAmount", "bankTransferAmount", "onlineAmount"))
    assert total == 3 and top[0][0] == "01/10/2026"
    assert [str(value) for value in top[0][1]] == ["100000", "50000", "0"]
    kpis = dict(exports._kpis(data))
    assert kpis["Tổng tiền thu (VND)"] == 450000 and kpis["Số phiếu thu"] == 6


def test_sales_kpis_and_filter_line():
    data = service_with_rows("sales", [example_row("sales")], company=408000).read(
        "sales", START, END, filters={"agencyId": "1"}, export=True
    )
    assert data["filters"] == {"agencyId": "1"}
    assert exports._filter_line(data["filters"]) == "Bộ lọc: Đại lý (ID) = 1"
    kpis = dict(exports._kpis(data))
    assert kpis["Doanh số toàn công ty (VND)"] == 408000
    assert exports._filter_line({"receiptType": "CASH"}) == "Bộ lọc: Hình thức thu = CASH"


def test_render_report_rejects_json_and_unknown_kind():
    with pytest.raises(ValueError, match="caller"):
        exports.render_report(dataset("sales"), exports.JSON_MEDIA)
    with pytest.raises(ValueError, match="kind"):
        exports.render_report(dataset("sales") | {"kind": "cash-and-credit"}, exports.PDF_MEDIA)


def test_exact_text_and_float_rejection():
    assert exports._text(None) == "" and exports._grouped(exports._number("-1234567.5")) == (
        "-1.234.567,5"
    )
    with pytest.raises(ValueError):
        exports._text(1.5)


def test_font_registration_is_idempotent():
    exports.register_font()
    exports.register_font()
    assert exports.FONT_PATH.is_file()
