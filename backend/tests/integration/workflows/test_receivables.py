import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.integration.catalogues.helpers import draft, install_builders, post_stock
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_financial_reads_share_exact_balances_and_filter_independent_statement(
    client, engine, trading, actor
):
    with Session(engine) as session:
        install_builders(session, actor)
        issue = draft(
            session,
            int(trading["product"]),
            kind="STOCK_ISSUE",
            agency_id=int(trading["agency"]),
            quantity="2",
        )
        post_stock(session, issue)
        session.commit()
    overview = client.get("/api/v1/receivables")
    assert overview.status_code == 200, overview.text
    assert_schema(overview.json(), "ReceivableOverviewListResponse")
    assert overview.json()["totals"]["currentDebt"] == "204"
    assert overview.json()["items"][0]["asOf"] == overview.json()["asOf"]
    agency = "/api/v1/agencies/" + trading["agency"]
    balance = client.get(agency + "/balance")
    assert balance.json()["currentDebt"] == "204"
    invoice = client.get(f"/api/v1/stock-issues/{issue}/balance")
    assert invoice.json()["outstandingAmount"] == "204"
    assert client.get(agency + "/invoice-balances").json()["items"] == [invoice.json()]
    statement = client.get(agency + "/receivable-entries", params={"kind": "PAYMENT"})
    assert statement.json()["items"] == []
    assert statement.json()["closingDebt"] == "204"
    full = client.get(agency + "/receivable-entries")
    assert full.json()["items"][0]["balanceAfter"] == "204"
    allocation = client.get(f"/api/v1/documents/{issue}/allocations")
    assert allocation.status_code == 200, allocation.text
    assert allocation.json()["items"] == []
    with engine.connect() as c:
        assert c.scalar(text('SELECT "currentDebt" FROM dms.agency_balance')) == 204
