"""Dashboard on real PostgreSQL over HTTP: figures, month selection and section permissions."""

from decimal import Decimal

import pytest

from tests.integration.reports.conftest import issue, payment, receipt

pytestmark = pytest.mark.integration


def month_of(day):
    return f"{day:%Y-%m}"


@pytest.fixture
def activity(ledger, world, dates, stocked):
    previous = dates["previousLast"]
    ledger.post("STOCK_ISSUE", issue(world.agency, (world.noodles, 10), business_date=previous))
    ledger.post("STOCK_ISSUE", issue(world.agency, (world.noodles, 2)))
    ledger.post("STOCK_ISSUE", issue(world.second_agency, (world.noodles, 1)))
    cancelled = ledger.post("STOCK_ISSUE", issue(world.second_agency, (world.rice, 4)))
    ledger.cancel("STOCK_ISSUE", cancelled)
    ledger.post("PAYMENT_RECEIPT", payment(world.agency, 100000))
    ledger.post("PAYMENT_RECEIPT", payment(world.agency, 50000, "BANK_TRANSFER"))
    ledger.online(world.second_agency, 20000)
    voided = ledger.post("PAYMENT_RECEIPT", payment(world.agency, 3000))
    ledger.cancel("PAYMENT_RECEIPT", voided)
    ledger.draft("PAYMENT_RECEIPT", payment(world.agency, 1000))
    ledger.draft("STOCK_ISSUE", issue(world.agency, (world.noodles, 1)))
    ledger.draft("STOCK_RECEIPT", receipt((world.noodles, 1, 90000)))
    ledger.draft("STOCK_RECEIPT", receipt((world.rice, 1, 19000)))


def test_manager_sees_every_section_with_exact_figures(login, activity, world, dates, ledger):
    response = login("manager").get("/api/v1/dashboard", params={"month": month_of(dates["today"])})
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "private, no-store"
    body = response.json()
    assert set(body) == {"month", "asOf", "agencies", "sales", "collections", "debt", "drafts"}
    assert body["agencies"] == {"total": 3, "active": 2}

    sales = body["sales"]
    assert (sales["salesAmount"], sales["issueCount"]) == ("306000", 2)
    trend = sales["monthlyTrend"]
    assert len(trend) == 12
    assert trend[-1] == {
        "month": month_of(dates["today"]),
        "salesAmount": "306000",
        "issueCount": 2,
    }
    assert trend[-2] == {
        "month": month_of(dates["previousLast"]),
        "salesAmount": "1020000",
        "issueCount": 1,
    }
    assert all(point["salesAmount"] == "0" for point in trend[:-2])
    assert sales["topProducts"] == [
        {
            "productId": str(world.noodles),
            "productCode": f"MH-{world.noodles}",
            "productName": "Mì Hảo Hảo thùng 30 gói",
            "unitId": world.carton,
            "unitName": "Thùng",
            "numberOfIssues": 2,
            "soldQuantity": "3",
            "salesAmount": "306000",
        }
    ]

    assert body["collections"] == {
        "receiptCount": 3,
        "totalAmount": "170000",
        "cashAmount": "100000",
        "bankTransferAmount": "50000",
        "onlineAmount": "20000",
    }

    _, debt = ledger.current()
    debt_section = body["debt"]
    assert debt_section["totalDebt"] == str(sum(value for value in debt.values() if value > 0))
    assert debt_section["totalDebt"] == "1156000"
    assert (debt_section["prepaidAmount"], debt_section["agenciesInDebt"]) == ("0", 2)
    assert debt_section["topAgencies"] == [
        {
            "agencyId": str(world.agency),
            "agencyCode": f"DL-{world.agency}",
            "agencyName": "Tạp hóa Hồng Phúc",
            "debt": "1074000",
            "maxDebt": "10000000",
            "debtRatio": "10.74",
        },
        {
            "agencyId": str(world.second_agency),
            "agencyCode": f"DL-{world.second_agency}",
            "agencyName": "Đại lý Thành Đạt",
            "debt": "82000",
            "maxDebt": "10000000",
            "debtRatio": "0.82",
        },
    ]
    assert body["drafts"] == {"stockReceipts": 2, "stockIssues": 1, "paymentReceipts": 1}


def test_previous_month_selection_keeps_current_balances(login, activity, dates):
    body = (
        login("manager")
        .get("/api/v1/dashboard", params={"month": month_of(dates["previousLast"])})
        .json()
    )
    assert (body["sales"]["salesAmount"], body["sales"]["issueCount"]) == ("1020000", 1)
    assert body["sales"]["monthlyTrend"][-1]["month"] == month_of(dates["previousLast"])
    assert body["collections"]["receiptCount"] == 0
    assert body["collections"]["totalAmount"] == "0"
    # Debt and drafts are current state, independent of the selected month.
    assert body["debt"]["totalDebt"] == "1156000"
    assert body["drafts"]["stockReceipts"] == 2


def test_over_limit_and_prepaid_agencies(login, ledger, world, dates, stocked):
    ledger.post("STOCK_ISSUE", issue(world.agency, (world.noodles, 90)))
    voided = ledger.post("PAYMENT_RECEIPT", payment(world.agency, 1000000))
    ledger.post("STOCK_ISSUE", issue(world.agency, (world.rice, 50)))
    # QĐ7: cancelling a payment may push the agency over its limit.
    ledger.cancel("PAYMENT_RECEIPT", voided)
    ledger.post("STOCK_ISSUE", issue(world.second_agency, (world.noodles, 1)))
    ledger.online(world.second_agency, 150000)

    _, debt = ledger.current()
    assert debt[str(world.agency)] == Decimal(10200000)
    assert debt[str(world.second_agency)] == Decimal(-48000)
    body = (
        login("accounting")
        .get("/api/v1/dashboard", params={"month": month_of(dates["today"])})
        .json()
    )
    section = body["debt"]
    assert section["totalDebt"] == "10200000"
    assert section["prepaidAmount"] == "48000"
    assert section["agenciesInDebt"] == 1
    assert [(row["agencyId"], row["debtRatio"]) for row in section["topAgencies"]] == [
        (str(world.agency), "102")
    ]


def test_empty_database_returns_zero_sections(login, dates):
    body = login("manager").get("/api/v1/dashboard", params={"month": month_of(dates["today"])})
    assert body.status_code == 200
    data = body.json()
    assert data["sales"]["salesAmount"] == "0" and data["sales"]["topProducts"] == []
    assert data["collections"]["receiptCount"] == 0
    assert data["debt"] == {
        "totalDebt": "0",
        "prepaidAmount": "0",
        "agenciesInDebt": 0,
        "topAgencies": [],
    }
    assert data["drafts"] == {"stockReceipts": 0, "stockIssues": 0, "paymentReceipts": 0}


@pytest.mark.parametrize(
    ("role", "sections", "drafts"),
    [
        ("sales", {"agencies", "sales", "collections", "debt", "drafts"}, {"stockIssues"}),
        ("warehouse", {"agencies", "drafts"}, {"stockReceipts", "stockIssues"}),
        ("accounting", {"agencies", "sales", "collections", "debt", "drafts"}, {"paymentReceipts"}),
    ],
)
def test_sections_follow_permissions(login, dates, role, sections, drafts):
    response = login(role).get("/api/v1/dashboard", params={"month": month_of(dates["today"])})
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"month", "asOf"} | sections
    assert set(body["drafts"]) == drafts


def test_dashboard_failures(login, dates):
    nobody = login("nobody")
    month = {"month": month_of(dates["today"])}
    denied = nobody.get("/api/v1/dashboard", params=month)
    assert denied.status_code == 403 and denied.json()["code"] == "FORBIDDEN"
    manager = login("manager")
    anonymous = manager.get("/api/v1/dashboard", params=month, headers={"Authorization": ""})
    assert anonymous.status_code == 401
    forged = manager.get(
        "/api/v1/dashboard", params=month, headers={"Authorization": "Bearer not-a-token"}
    )
    assert forged.status_code == 401
    for bad in ("2026-13", "2026-1", "0000-01", "2026/11"):
        assert manager.get("/api/v1/dashboard", params={"month": bad}).status_code == 422
    assert manager.get("/api/v1/dashboard").status_code == 422
