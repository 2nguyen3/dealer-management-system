"""KPI band and chart summary added to PDF/XLSX report exports."""

import re
from datetime import UTC, date, datetime
from decimal import Decimal
from io import BytesIO
from zipfile import ZipFile

import pytest
from pypdf import PdfReader
from reportlab.pdfbase.pdfmetrics import stringWidth

from app.modules.document_history.printing import register_font
from app.modules.reports import exporting as exports
from tests.reports.test_exports import workbook_rows
from tests.reports.test_paging import END, START, service_with_rows
from tests.reports.test_schemas import example_row

BLUE_FILL = b".164706 .470588 .839216 rg"
ORANGE_FILL = b".921569 .407843 .203922 rg"
MEASURES = {
    "sales": ("salesAmount", "returnAmount", "netSalesAmount"),
    "debt": ("openingDebt", "debtIncrease", "debtDecrease", "closingDebt"),
    "inventory": ("openingStock", "receiptQuantity", "issueQuantity", "closingStock"),
    "product-sales": ("salesAmount", "returnAmount", "netSalesAmount"),
    "cash-and-credit": ("cashReceived", "cashRefunded", "openingCredit", "closingCredit"),
}


def export(kind, count, name=None):
    """Canonical export projection with distinct, descending-by-ID money/quantities."""
    rows = []
    for index in range(1, count + 1):
        row = example_row(kind, str(index))
        for offset, key in enumerate(MEASURES[kind]):
            row[key] = Decimal(index * 1000000 + offset * 1000)
        if kind == "sales":
            row["numberOfIssues"] = index
        if name is not None:
            row["productName" if "productName" in row else "agencyName"] = name
        rows.append(row)
    return service_with_rows(kind, rows).read(kind, START, END, export=True)


def pdf_first_page(dataset):
    page = PdfReader(BytesIO(exports.render_pdf(dataset))).pages[0]
    return page.extract_text(), page.get_contents().get_data()


def summary(content):
    with ZipFile(BytesIO(content)) as archive:
        names = archive.namelist()
        charts = [
            archive.read(name).decode("utf-8")
            for name in sorted(names)
            if re.fullmatch(r"xl/charts/chart\d+\.xml", name)
        ]
        book = archive.read("xl/workbook.xml").decode("utf-8")
    return workbook_rows(content)[-1], charts, book


def after_kpi_header(sheet):
    """Summary rows following the KPI table header (workbook_rows skips empty rows)."""
    index = next(i for i, row in enumerate(sheet) if row[:1] == [("s", "Chỉ số")])
    return sheet[index + 1 :]


@pytest.mark.parametrize("kind", sorted(exports.KINDS))
def test_pdf_first_page_has_kpi_band_and_two_charts_before_the_table(kind):
    dataset = export(kind, 4)
    text, stream = pdf_first_page(dataset)
    spec = exports.VISUALS[kind]
    for key in spec["kpis"]:
        assert exports._field_label(key) in text
    for title, _ in spec["charts"]:
        assert title in text
    # One-measure bars use the single hue; two-measure charts add slot two + legend.
    assert BLUE_FILL in stream and ORANGE_FILL in stream
    first, second = (exports._field_label(key) for key in spec["charts"][1][1])
    assert first in text and second in text
    assert exports.EMPTY_NOTE not in text
    # KPI first, then charts, then the detailed table header.
    flat = text.replace("\n", " ")
    kpi = flat.index(exports._field_label(spec["kpis"][0]))
    chart = flat.index(spec["charts"][0][0])
    identity = dict(dataset["columns"])[exports.IDENTITIES[kind]]
    assert identity != exports.IDENTITIES[kind]  # localized export header
    assert kpi < chart < flat.rindex(identity)
    assert "Nhãn dài được rút gọn" in text


def test_pdf_kpis_are_exact_grouped_totals():
    dataset = export("sales", 5)
    text, _ = pdf_first_page(dataset)
    assert exports._grouped(Decimal(dataset["totals"]["salesAmount"])) == "15.000.000"
    assert "15.000.000" in text and "Số phiếu xuất" in text


def test_bar_drawing_labels_only_top_bars_and_legends_only_multi_series():
    register_font()
    top = [(f"Agency {index}", [Decimal(10 - index), Decimal(index)]) for index in range(5)]
    one = [(label, values[:1]) for label, values in top]
    single = exports._bar_drawing(one, ("netSalesAmount",), 300)
    chart = single.contents[0]
    assert chart.barLabelArray == [["10", "9", "8", None, None]]
    assert [chart.bars[0].fillColor.hexval()] == ["0x2a78d6"]
    assert len(single.contents) == 1
    assert single.height == exports.CHART_HEIGHT - (exports.CHART_HEIGHT - 20) / 2
    grouped = exports._bar_drawing(top, ("salesAmount", "returnAmount"), 300)
    chart = grouped.contents[0]
    assert chart.barLabelArray is None
    # Series are reversed for the reversed category axis: slot one stays on top.
    assert chart.data[1] == [10.0, 9.0, 8.0, 7.0, 6.0]
    assert [chart.bars[index].fillColor.hexval() for index in (0, 1)] == ["0xeb6834", "0x2a78d6"]
    legend = [item.text for item in grouped.contents[1:] if hasattr(item, "text")]
    assert legend == ["Doanh số bán (VND)", "Hàng trả (VND)"]
    assert chart.categoryAxis.categoryNames == [label for label, _ in top]


def test_pdf_and_xlsx_empty_rows_show_notes_and_draw_no_charts():
    dataset = export("debt", 0)
    text, stream = pdf_first_page(dataset)
    assert text.count(exports.EMPTY_NOTE) == 2
    assert BLUE_FILL not in stream and ORANGE_FILL not in stream
    assert "Nợ đầu kỳ (VND)" in text
    sheet, charts, _ = summary(exports.render_xlsx(dataset))
    assert charts == []
    cells = [cell for row in sheet for cell in row]
    assert cells.count(("s", exports.EMPTY_NOTE)) == 4
    assert ("s", "Nợ cuối kỳ (VND)") in cells and (None, "0") in cells


def test_missing_kpi_fields_skip_band_and_summary_note():
    dataset = export("sales", 2)
    dataset["kind"] = "debt"
    text, _ = pdf_first_page(dataset)
    assert "Nợ đầu kỳ (VND)" not in text and "Top đại lý theo nợ cuối kỳ (VND)" in text
    assert text.count(exports.EMPTY_NOTE) == 2
    sheet, charts, _ = summary(exports.render_xlsx(dataset))
    assert charts == []
    assert after_kpi_header(sheet)[0][0] == ("s", exports.EMPTY_NOTE)


@pytest.mark.parametrize("kind", sorted(exports.KINDS))
def test_xlsx_summary_sheet_is_last_active_and_has_native_palette_charts(kind):
    dataset = export(kind, 3)
    content = exports.render_xlsx(dataset)
    sheet, charts, book = summary(content)
    names = re.findall(r'<sheet name="([^"]+)"', book)
    assert names[-1] == exports.SUMMARY_SHEET
    assert f'activeTab="{len(names) - 1}"' in book
    assert workbook_rows(content)[1][1][0] == ("s", dataset["rows"][0][exports.IDENTITIES[kind]])
    # Branded header (workbook_rows lists only written rows), then headed sections.
    assert sheet[:4] == [
        [("s", exports.BRAND_LINE)],
        [("s", dataset["title"])],
        [("s", "Kỳ báo cáo: 01/01/2026 – 31/01/2026")],
        [("s", "Bộ lọc: tất cả · Lập lúc 07:00 10/01/2026 (giờ Việt Nam)")],
    ]
    assert sheet[4][0] == ("s", "Chỉ số chính") and len(sheet[4]) == 13
    assert sheet[5] == [("s", "Chỉ số"), ("s", "Giá trị")]
    kpis = exports._kpis(dataset)
    assert [row[0][1] for row in sheet[6 : 6 + len(kpis)]] == [label for label, _ in kpis]
    assert all(row[1][0] is None for row in sheet[6 : 6 + len(kpis)])
    assert sheet[6 + len(kpis)][0] == ("s", "Biểu đồ")
    assert len(charts) == 2
    single, grouped = charts
    for xml in charts:
        assert '<c:barDir val="bar"/>' in xml
        assert "<c:f>'Tổng quan'!$A$" in xml
        assert 'orientation val="maxMin"' in xml
        assert "E1E0D9" in xml and "898781" in xml
    assert "2A78D6" in single and "EB6834" not in single and "<c:legend>" not in single
    assert "2A78D6" in grouped and "EB6834" in grouped and "<c:legend>" in grouped
    assert "<c:dLbls>" in single and "<c:dLbls>" not in grouped
    # Chart data is numeric and sorted by the measure, largest first.
    data = [row for row in sheet if len(row) == 2 and row[1][0] is None][len(kpis) :]
    values = [float(row[1][1]) for row in data]
    assert values == sorted(values, reverse=True) and len(values) == 3


def test_many_rows_fold_to_top_ten_with_caption_and_labels_only_top_three():
    dataset = export("cash-and-credit", 25)
    sheet, charts, _ = summary(exports.render_xlsx(dataset))
    caption = "Hiển thị 10/25 dòng lớn nhất; các dòng còn lại có trong bảng chi tiết."
    cells = [cell for row in sheet for cell in row]
    assert cells.count(("s", caption)) == 2
    single = charts[0]
    assert '<c:ptCount val="10"/>' in single
    assert re.findall(r'<c:dLbl><c:idx val="(\d+)"/><c:delete val="1"/>', single) == [
        str(index) for index in range(3, 10)
    ]
    text, _ = pdf_first_page(dataset)
    assert text.count(caption) == 2
    assert text.count("Same name") >= 10


def test_long_names_truncate_for_charts_but_stay_exact_in_tables():
    long_name = "Đại lý   rất\ndài " + "Nguyễn " * 40
    dataset = export("sales", 2, name=long_name)
    label = exports._chart_label("sales", dataset["rows"][0])
    assert len(label) == exports.LABEL_CHARS and label.endswith("…")
    assert "\n" not in label and "  " not in label
    sheet, charts, _ = summary(exports.render_xlsx(dataset))
    assert ("s", label) in [cell for row in sheet for cell in row]
    assert all(long_name not in chart for chart in charts)
    rows = workbook_rows(exports.render_xlsx(dataset))[1]
    assert ("s", long_name) in rows[1]
    text, _ = pdf_first_page(dataset)
    assert label in text


def test_chart_label_fallbacks_and_units():
    product = example_row("inventory", "7", productName=" \n ", unitName="Thùng carton lớn")
    assert exports._chart_label("inventory", product) == "7 (Thùng cart)"
    product["unitName"] = ""
    product["productName"] = "Nước suối"
    assert exports._chart_label("inventory", product) == "Nước suối"
    agency = example_row("debt", "9", agencyName="")
    assert exports._chart_label("debt", agency) == "9"


def test_chart_rows_skip_non_numeric_and_non_positive_values():
    dataset = export("sales", 0)
    dataset["rows"] = [
        {"agencyId": "1", "agencyName": "A", "salesAmount": "0", "returnAmount": "5"},
        {"agencyId": "2", "agencyName": "B", "salesAmount": "0", "returnAmount": "0"},
        {"agencyId": "3", "agencyName": "C", "salesAmount": "abc", "returnAmount": "9"},
        {"agencyId": "4", "agencyName": "D", "salesAmount": "-3", "returnAmount": "-1"},
        {"agencyId": "5", "agencyName": "E", "salesAmount": "7"},
    ]
    top, total = exports._chart_rows(dataset, ("salesAmount", "returnAmount"))
    assert top == [("A", [Decimal(0), Decimal(5)])] and total == 1
    assert exports._chart_rows(dataset, ("salesAmount",)) == ([("E", [Decimal(7)])], 1)


def test_inventory_counters_and_exact_or_text_kpi_cells():
    dataset = export("inventory", 0)
    dataset["rows"] = [
        example_row("inventory", "1", closingStock="5"),
        example_row("inventory", "2", closingStock="0"),
        example_row("inventory", "3", closingStock="bad"),
    ]
    assert exports._kpis(dataset) == [
        ("Số mặt hàng", Decimal(3)),
        ("Mặt hàng còn tồn", Decimal(1)),
        ("Mặt hàng hết tồn", Decimal(1)),
    ]
    sales = export("sales", 1)
    sales["totals"].update(salesAmount="1" + "0" * 15, returnAmount="0.5")
    sheet, _, _ = summary(exports.render_xlsx(sales))
    kpi_rows = after_kpi_header(sheet)
    assert kpi_rows[0][1] == ("s", "1" + "0" * 15)
    assert kpi_rows[1][1] == ("s", "0.5")
    assert kpi_rows[2][1] == (None, str(int(Decimal(sales["totals"]["netSalesAmount"]))))
    text, _ = pdf_first_page(sales)
    flat = text.replace("\n", "")
    assert "1.000.000.000.000.000" in flat and "0,5" in flat


def test_pdf_kpi_value_wider_than_its_box_wraps_smaller():
    dataset = export("cash-and-credit", 1)
    dataset["totals"]["cashReceived"] = "9" * 60
    text, _ = pdf_first_page(dataset)
    assert exports._grouped(Decimal("9" * 60)) in text.replace("\n", "")


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (0, "0"),
        (0.5, "0,5"),
        (999, "999"),
        (1000, "1 N"),
        (-2500, "-2,5 N"),
        (1500000, "1,5 tr"),
        (2300000000, "2,3 tỷ"),
        (999999999999999, "1000000 tỷ"),
        (1e15, "1,0e+15"),
        (-1.234e39, "-1,2e+39"),
    ],
)
def test_compact_axis_labels(value, expected):
    assert exports._compact(value) == expected


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (Decimal(0), "0"),
        (Decimal("1E+3"), "1.000"),
        (Decimal("-1234567.50"), "-1.234.567,50"),
        (Decimal("0.001"), "0,001"),
    ],
)
def test_grouped_exact_kpi_values(value, expected):
    assert exports._grouped(value) == expected


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (5, Decimal(5)),
        (Decimal("2.5"), Decimal("2.5")),
        ("-12.50", Decimal("-12.50")),
        (True, None),
        ("1e3", None),
        ("abc", None),
        (None, None),
        (1.5, None),
    ],
)
def test_number_accepts_only_exact_scalars(value, expected):
    assert exports._number(value) == expected


def test_fit_shortens_to_width_and_never_loops_forever():
    register_font()
    text = exports._fit("Đại lý Nguyễn Ánh rất dài", 40)
    assert text.endswith("…")
    assert stringWidth(text, exports.FONT, exports.CHART_FONT_SIZE) <= 40
    assert exports._fit("abc", 0) == "…"
    assert exports._fit("abc", 100) == "abc"


def test_pdf_branded_header_headings_logo_and_running_header():
    dataset = export("sales", 60, name="Đại lý\n" * 3)
    reader = PdfReader(BytesIO(exports.render_pdf(dataset)))
    pages = [page.extract_text() for page in reader.pages]
    first = pages[0]
    for text in (
        exports.BRAND_LINE,
        "Báo cáo doanh số",
        "Kỳ báo cáo: 01/01/2026 – 31/01/2026",
        "Bộ lọc: tất cả · Lập lúc 07:00 10/01/2026 (giờ Việt Nam)",
        "Chỉ số chính",
        "Biểu đồ",
    ):
        assert text in first
    every = "\n".join(pages)
    for heading in ("Chi tiết số liệu", "Tổng cộng (toàn bộ dữ liệu theo bộ lọc)", "Ghi chú"):
        assert heading in every
    assert "Kind:" not in every and "fromDate:" not in every
    assert len(pages) >= 3
    for number, (page, text) in enumerate(zip(reader.pages, pages, strict=True), 1):
        assert f"Agentra · Trang {number}/{len(pages)}" in text
        images = [
            item.get_object()
            for item in page["/Resources"].get("/XObject", {}).values()
            if item.get_object()["/Subtype"] == "/Image"
        ]
        # Page 1 carries the full logo; later pages the small running-header icon.
        assert [(image["/Width"], image["/Height"]) for image in images] == (
            [(320, 234)] if number == 1 else [(64, 64)]
        )
        assert ("Agentra · Báo cáo doanh số" in text) is (number > 1)


def test_pdf_totals_section_labels_keys_and_exact_values():
    dataset = export("sales", 2)
    text = "\n".join(
        page.extract_text() for page in PdfReader(BytesIO(exports.render_pdf(dataset))).pages
    )
    for key, value in dataset["totals"].items():
        assert key in text and str(value) in text
    assert "Doanh số toàn công ty" in text and "Số phiếu xuất" in text


def test_xlsx_summary_embeds_logo_drawing():
    content = exports.render_xlsx(export("debt", 2))
    with ZipFile(BytesIO(content)) as archive:
        names = archive.namelist()
        assert "xl/media/image1.png" in names
        assert archive.read("xl/media/image1.png") == exports.LOGO_PATH.read_bytes()
        drawing = archive.read("xl/drawings/drawing1.xml").decode("utf-8")
    assert 'descr="agentra-logo.png"' in drawing
    assert "<xdr:col>0</xdr:col>" in drawing and "<xdr:row>0</xdr:row>" in drawing


@pytest.mark.parametrize(
    ("period", "expected"),
    [
        (
            {"fromDate": "2026-09-01", "toDate": "2026-10-01"},
            "Kỳ báo cáo: 01/09/2026 – 30/09/2026",
        ),
        (
            {"fromDate": date(2026, 2, 28), "toDate": date(2026, 3, 1)},
            "Kỳ báo cáo: 28/02/2026 – 28/02/2026",
        ),
        (
            {"fromDate": "2025-12-01", "toDate": "2026-01-01"},
            "Kỳ báo cáo: 01/12/2025 – 31/12/2025",
        ),
    ],
)
def test_period_line_renders_exclusive_end_as_last_included_day(period, expected):
    assert exports._period_line(period) == expected


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("2026-09-30T17:05:00Z", "Lập lúc 00:05 01/10/2026 (giờ Việt Nam)"),
        (datetime(2026, 9, 30, 1, 2, tzinfo=UTC), "Lập lúc 08:02 30/09/2026 (giờ Việt Nam)"),
        ("2026-09-30T10:00:00", "Lập lúc 17:00 30/09/2026 (giờ Việt Nam)"),
    ],
)
def test_generated_line_uses_vietnam_time(value, expected):
    assert exports._generated_line({"generatedAt": value}) == expected


def test_filter_line_labels_known_and_unknown_filters():
    assert exports._filter_line({}) == "Bộ lọc: tất cả"
    assert (
        exports._filter_line({"agencyId": "5", "typeId": 2, "districtId": 3, "x": "y"})
        == "Bộ lọc: Đại lý (ID) = 5; Loại đại lý (ID) = 2; Quận/huyện (ID) = 3; x = y"
    )
    assert exports._filter_line({"productId": "9"}) == "Bộ lọc: Mặt hàng (ID) = 9"
