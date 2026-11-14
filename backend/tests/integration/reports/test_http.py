"""Report routes over HTTP: permissions, content negotiation and exports on real data."""

from io import BytesIO
from zipfile import ZipFile

import pytest
from pypdf import PdfReader

from tests.integration.reports.conftest import issue, payment

pytestmark = pytest.mark.integration

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
ROUTES = ("sales", "debt", "inventory", "product-sales", "collections")


@pytest.fixture
def period(dates):
    return {"fromDate": dates["start"].isoformat(), "toDate": dates["end"].isoformat()}


@pytest.fixture
def trading(ledger, world, stocked):
    ledger.post("STOCK_ISSUE", issue(world.agency, (world.noodles, 2)))
    ledger.post("PAYMENT_RECEIPT", payment(world.agency, 54321, "BANK_TRANSFER"))
    ledger.online(world.agency, 1000)


def test_manager_reads_every_report_as_exact_json(login, period, trading, world, dates):
    client = login("manager")
    for route in ROUTES:
        response = client.get(f"/api/v1/reports/{route}", params=period)
        assert response.status_code == 200, (route, response.text)
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["vary"] == "Accept"
        body = response.json()
        assert body["fromDate"] == period["fromDate"] and body["toDate"] == period["toDate"]
        assert body["pagination"]["limit"] == 25
    sales = client.get("/api/v1/reports/sales", params=period).json()
    assert sales["items"] == [
        {
            "agencyId": str(world.agency),
            "agencyCode": f"DL-{world.agency}",
            "agencyName": "Tạp hóa Hồng Phúc",
            "numberOfIssues": 1,
            "salesAmount": "204000",
            "salesRate": "100",
        }
    ]
    assert sales["totals"] == {
        "numberOfIssues": 1,
        "salesAmount": "204000",
        "companySalesAmount": "204000",
    }
    debt = client.get("/api/v1/reports/debt", params=period).json()
    assert debt["items"][0] == {
        "agencyId": str(world.agency),
        "agencyCode": f"DL-{world.agency}",
        "agencyName": "Tạp hóa Hồng Phúc",
        "openingDebt": "0",
        "debtIncrease": "204000",
        "paidAmount": "55321",
        "closingDebt": "148679",
    }
    collections = client.get(
        "/api/v1/reports/collections", params=period | {"receiptType": "ONLINE"}
    ).json()
    assert collections["totals"]["onlineAmount"] == "1000"
    assert collections["totals"]["bankTransferAmount"] == "0"
    assert [row["businessDate"] for row in collections["items"]] == [dates["today"].isoformat()]


def test_collections_replaces_cash_and_credit(login, period):
    client = login("manager")
    assert client.get("/api/v1/reports/cash-and-credit", params=period).status_code == 404
    bad = client.get("/api/v1/reports/collections", params=period | {"receiptType": "REFUND"})
    assert bad.status_code == 422


@pytest.mark.parametrize(
    ("role", "allowed"),
    [
        ("manager", set(ROUTES)),
        ("accounting", set(ROUTES)),
        ("sales", set()),
        ("warehouse", set()),
        ("nobody", set()),
    ],
)
def test_report_permissions(login, period, role, allowed):
    client = login(role)
    for route in ROUTES:
        status = client.get(f"/api/v1/reports/{route}", params=period).status_code
        assert status == (200 if route in allowed else 403), (role, route, status)


def test_requests_without_token_or_with_bad_period_fail(login, period, dates):
    client = login("manager")
    anonymous = client.get("/api/v1/reports/sales", params=period, headers={"Authorization": ""})
    assert anonymous.status_code == 401
    same_day = {"fromDate": period["fromDate"], "toDate": period["fromDate"]}
    assert client.get("/api/v1/reports/sales", params=same_day).status_code == 422
    assert client.get("/api/v1/reports/sales", params={"fromDate": "x"}).status_code == 422
    assert client.get("/api/v1/reports/sales", params=period | {"limit": "101"}).status_code == 422
    assert client.get("/api/v1/reports/sales", params=period | {"limit": "ten"}).status_code == 422
    assert client.get("/api/v1/reports/sales", params=period | {"sort": "x"}).status_code == 422
    assert client.get("/api/v1/reports/sales", params=period | {"cursor": "bad"}).status_code == 400
    html = client.get("/api/v1/reports/sales", params=period, headers={"Accept": "text/html"})
    assert html.status_code == 406


def test_xlsx_and_pdf_exports_carry_real_figures(login, period, trading):
    client = login("manager")
    workbook = client.get("/api/v1/reports/debt", params=period, headers={"Accept": XLSX})
    assert workbook.status_code == 200
    assert workbook.headers["content-type"] == XLSX
    assert 'filename="report-debt.xlsx"' in workbook.headers["content-disposition"]
    with ZipFile(BytesIO(workbook.content)) as archive:
        strings = archive.read("xl/sharedStrings.xml").decode("utf-8")
    assert "Báo cáo công nợ tháng" in strings and "148679" in strings and "Đã trả" in strings

    document = client.get(
        "/api/v1/reports/collections", params=period, headers={"Accept": "application/pdf"}
    )
    assert document.status_code == 200
    assert document.headers["content-type"] == "application/pdf"
    text = "".join(page.extract_text() for page in PdfReader(BytesIO(document.content)).pages)
    assert "Báo cáo thu tiền" in text and "54321" in text and "Chuyển khoản" in text
