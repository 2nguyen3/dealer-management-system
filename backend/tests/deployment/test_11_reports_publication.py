"""Read-only report checks on the existing direct, proxy and public deployment."""

import os
import xml.etree.ElementTree as ET
from io import BytesIO
from zipfile import ZipFile

import httpx
import pytest
from pypdf import PdfReader

from app.db.seed import DEMO_USERS
from tests.support.contract import assert_schema

pytestmark = [pytest.mark.integration, pytest.mark.deployment]
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REPORTS = {
    "sales": "SalesReportResponse",
    "debt": "DebtReportResponse",
    "inventory": "InventoryReportResponse",
    "product-sales": "ProductSalesReportResponse",
    "cash-and-credit": "CashCreditReportResponse",
}


def workbook_tables(content):
    with ZipFile(BytesIO(content)) as archive:
        names = archive.namelist()
        assert not any("externalLink" in name or "vbaProject" in name for name in names)
        strings = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        shared = ["".join(item.itertext()) for item in strings]
        tables = []
        for name in sorted(names):
            if not name.startswith("xl/worksheets/sheet") or not name.endswith(".xml"):
                continue
            root = ET.fromstring(archive.read(name))
            assert root.find(".//s:f", NS) is None
            assert root.find(".//s:hyperlink", NS) is None
            table = []
            for row in root.findall("s:sheetData/s:row", NS):
                cells = {}
                for cell in row.findall("s:c", NS):
                    value = cell.find("s:v", NS)
                    if value is not None:
                        cells[cell.attrib["r"].rstrip("0123456789")] = (
                            shared[int(value.text)] if cell.get("t") == "s" else value.text
                        )
                table.append(list(cells.values()))
            tables.append(table)
        return tables


@pytest.mark.parametrize("variable", ["M30_DIRECT_URL", "M30_PROXY_URL", "M30_PUBLIC_URL"])
def test_published_reports_json_xlsx_pdf_preserve_full_filtered_values(variable):
    base = os.environ.get(variable)
    if not base:
        pytest.fail("Explicit existing development URL required")
    with httpx.Client(
        base_url=base,
        timeout=90,
        headers={"ngrok-skip-browser-warning": "true", "Origin": "http://localhost:5173"},
    ) as client:
        period = {"fromDate": "2026-06-01", "toDate": "2026-10-01"}
        for kind in REPORTS:
            denied = client.get(f"/api/v1/reports/{kind}", params=period)
            assert denied.status_code == 401
            assert denied.headers.get("X-Request-Id")
        login = client.post(
            "/api/v1/auth/login", json={"email": DEMO_USERS[0][0], "password": DEMO_USERS[0][3]}
        )
        assert login.status_code == 200
        credentials = login.json()
        client.headers["Authorization"] = "Bearer " + credentials["accessToken"]
        try:
            for kind, schema in REPORTS.items():
                path = f"/api/v1/reports/{kind}"
                identifier = "productId" if kind in ("inventory", "product-sales") else "agencyId"
                params = {**period, "limit": 1, "sort": identifier}
                rows = []
                while True:
                    response = client.get(path, params=params)
                    assert response.status_code == 200, response.text
                    payload = response.json()
                    assert_schema(payload, schema)
                    rows.extend(payload["items"])
                    if not payload["pagination"]["hasMore"]:
                        break
                    params["cursor"] = payload["pagination"]["nextCursor"]
                    params["limit"] = 100
                assert rows, f"Expected historical demo rows for {kind}"
                assert len({row[identifier] for row in rows}) == len(rows)
                for media in (XLSX, "application/pdf"):
                    exported = client.get(
                        path,
                        params={**period, "limit": "invalid", "cursor": "foreign", "sort": "bad"},
                        headers={"Accept": media},
                    )
                    assert exported.status_code == 200, exported.text[:1000]
                    assert exported.headers["Content-Type"] == media
                    assert exported.headers["Cache-Control"] == "no-store"
                    assert {
                        value.strip().lower()
                        for value in exported.headers["X-Content-Type-Options"].split(",")
                    } == {"nosniff"}
                    assert "accept" in {
                        field.strip().lower() for field in exported.headers["Vary"].split(",")
                    }
                    assert exported.headers.get("X-Request-Id")
                    assert "attachment;" in exported.headers["Content-Disposition"]
                    assert (
                        "Content-Disposition" in exported.headers["Access-Control-Expose-Headers"]
                    )
                    if media == XLSX:
                        tables = workbook_tables(exported.content)
                        row_table = tables[1]
                        keys = row_table[0][2:]
                        expected = [[str(row[key]) for key in keys] for row in rows]
                        assert [row[2:] for row in row_table[1:]] == expected
                        if "totals" in payload:
                            total_table = tables[2]
                            assert total_table[1][2:] == [
                                str(payload["totals"][key]) for key in total_table[0][2:]
                            ]
                    else:
                        assert exported.content.startswith(b"%PDF-")
                        document = PdfReader(BytesIO(exported.content))
                        text = "".join(
                            "".join(page.extract_text().split()) for page in document.pages
                        )
                        for row in rows:
                            for value in row.values():
                                assert "".join(str(value).split()) in text
                        for key, value in payload.get("totals", {}).items():
                            assert f"{key}:{value}" in text
                unsupported = client.get(path, params=period, headers={"Accept": "text/html"})
                assert unsupported.status_code == 406
                invalid = client.get(path, params={**period, "toDate": period["fromDate"]})
                assert invalid.status_code == 422
        finally:
            logout = client.post(
                "/api/v1/auth/logout", json={"refreshToken": credentials["refreshToken"]}
            )
            assert logout.status_code == 204
