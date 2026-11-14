import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from tests.integration.catalogues.helpers import (
    cancel_stock,
    draft,
    install_builders,
    payment,
    post_stock,
)
from tests.integration.master_data.test_contract import body_for
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_product_unit_stock_price_filters_and_cancellation(client, engine, actor, masters):
    path = "/api/v1/products"
    created = client.post(path, json=body_for("products", masters))
    assert created.status_code == 201, created.text
    detail = created.headers["Location"]
    fresh = created.json()
    assert fresh["stock"] == "0" and fresh["lastPurchasePrice"] is None
    assert fresh["sellingPrice"] is None
    legacy = {**body_for("products", masters), "lowStockThreshold": "1"}
    assert client.post(path, json=legacy).status_code == 422
    assert client.post(path, json={"name": "x", "unitId": 999999}).status_code == 404
    unit = client.post("/api/v1/units", json={"code": "OTHER", "name": "Other"}).json()["id"]
    changed = client.patch(
        detail, json={"unitId": unit}, headers={"If-Match": created.headers["ETag"]}
    )
    assert changed.status_code == 200 and changed.json()["unitId"] == unit
    unit_detail = client.get("/api/v1/units/" + str(unit))
    assert (
        client.patch(
            "/api/v1/units/" + str(unit),
            json={"status": "INACTIVE"},
            headers={"If-Match": unit_detail.headers["ETag"]},
        ).status_code
        == 200
    )
    assert client.post(path, json={"name": "x", "unitId": unit}).status_code == 409
    unit_detail = client.get("/api/v1/units/" + str(unit))
    client.patch(
        "/api/v1/units/" + str(unit),
        json={"status": "ACTIVE"},
        headers={"If-Match": unit_detail.headers["ETag"]},
    )
    # Near-limit genuine receipt price; stock/price change only through posting.
    with Session(engine) as session:
        install_builders(session, actor)
        document = draft(session, int(fresh["id"]), price="600000000000000000")
        post_stock(session, document)
        session.commit()
    rules = client.get("/api/v1/business-rules")
    assert (
        client.patch(
            "/api/v1/business-rules",
            json={"sellingPriceRate": "2"},
            headers={"If-Match": rules.headers["ETag"]},
        ).status_code
        == 200
    )
    product = client.get(detail)
    assert product.json()["stock"] == "1"
    assert product.json()["lastPurchasePrice"] == "600000000000000000"
    assert product.json()["sellingPrice"] == "1200000000000000000"
    assert_schema(product.json(), "ProductResponse")
    assert (
        client.patch(
            detail, json={"unitId": masters[1]}, headers={"If-Match": product.headers["ETag"]}
        ).status_code
        == 409
    )
    assert client.delete(detail, headers={"If-Match": product.headers["ETag"]}).status_code == 409
    filtered = client.get(
        path,
        params={
            "q": "Same",
            "code": product.json()["code"],
            "unitId": unit,
            "status": "ACTIVE",
            "stockFrom": "1",
            "stockTo": "1",
        },
    )
    assert filtered.json()["items"] == [product.json()]
    assert client.get(path, params={"stockFrom": "2", "stockTo": "1"}).status_code == 422
    assert client.get(path, params={"stockFrom": "1.0001"}).status_code == 422
    # Price 1 with the smallest valid rate rounds the quote to zero.
    small = client.post(path, json={"name": "Small", "unitId": unit}).json()
    with Session(engine) as session:
        install_builders(session, actor)
        post_stock(session, draft(session, int(small["id"]), price="1"))
        session.commit()
    rules = client.get("/api/v1/business-rules")
    assert (
        client.patch(
            "/api/v1/business-rules",
            json={"sellingPriceRate": "0.000001"},
            headers={"If-Match": rules.headers["ETag"]},
        ).status_code
        == 200
    )
    assert client.get("/api/v1/products/" + small["id"]).json()["sellingPrice"] == "0"
    # Cancelling the only receipt restores zero stock and clears the purchase price.
    with Session(engine) as session:
        install_builders(session, actor)
        cancel_stock(session, document)
        session.commit()
    cancelled = client.get(detail)
    assert cancelled.json()["stock"] == "0" and cancelled.json()["lastPurchasePrice"] is None
    assert cancelled.json()["sellingPrice"] is None
    assert client.delete(detail, headers={"If-Match": cancelled.headers["ETag"]}).status_code == 409


def test_recorded_product_and_direct_balance_denial(client, engine, actor, masters):
    product = client.post("/api/v1/products", json=body_for("products", masters))
    path = product.headers["Location"]
    identifier = int(product.json()["id"])
    with Session(engine) as session:
        install_builders(session, actor)
        draft(session, identifier)
        session.commit()
    other = client.post("/api/v1/units", json={"code": "SECOND", "name": "Second"}).json()["id"]
    assert (
        client.patch(
            path, json={"unitId": other}, headers={"If-Match": product.headers["ETag"]}
        ).status_code
        == 409
    )
    assert client.delete(path, headers={"If-Match": product.headers["ETag"]}).status_code == 409
    for command in (
        "UPDATE dms.product SET stock=1 WHERE id=:id",
        'UPDATE dms.product SET "lastPurchasePrice"=1 WHERE id=:id',
        "DELETE FROM dms.product WHERE id=:id",
    ):
        with pytest.raises(DBAPIError) as error, engine.begin() as c:
            c.execute(text(command), {"id": identifier})
        assert error.value.orig.sqlstate == "23514"
    with engine.connect() as c:
        row = c.execute(
            text('SELECT stock, "lastPurchasePrice" FROM dms.product WHERE id=:id'),
            {"id": identifier},
        ).one()
        assert row.stock == 0 and row.lastPurchasePrice is None


def test_agency_master_capacity_contact_history_type_debt_and_termination(
    client, engine, actor, masters
):
    path = "/api/v1/agencies"
    body = body_for("agencies", masters)
    for invalid in ({"typeId": 99999}, {"wardId": 99999}):
        assert client.post(path, json={**body, **invalid}).status_code == 404
    inactive_type = client.post(
        "/api/v1/agency-types",
        json={"code": "OFF", "name": "Off", "maxDebt": "0", "status": "INACTIVE"},
    ).json()["id"]
    assert client.post(path, json={**body, "typeId": inactive_type}).status_code == 409
    agency = client.post(path, json={**body, "phone": "123", "address": "Address"})
    assert agency.status_code == 201, agency.text
    detail = agency.headers["Location"]
    cleared = client.patch(
        detail,
        json={"phone": None, "address": None, "acceptedDate": "2025-01-01"},
        headers={"If-Match": agency.headers["ETag"]},
    )
    assert cleared.status_code == 200 and cleared.json()["phone"] is None
    low_type = client.post(
        "/api/v1/agency-types", json={"code": "LOW", "name": "Low", "maxDebt": "0"}
    ).json()["id"]
    destination = masters[0] + 1
    moved = client.patch(
        detail,
        json={"typeId": low_type, "wardId": destination},
        headers={"If-Match": cleared.headers["ETag"]},
    )
    assert moved.status_code == 200, moved.text
    moved = client.patch(detail, json={"typeId": 1}, headers={"If-Match": moved.headers["ETag"]})
    product = client.post("/api/v1/products", json=body_for("products", masters)).json()
    with Session(engine) as session:
        install_builders(session, actor)
        receipt = draft(session, int(product["id"]), quantity="10")
        post_stock(session, receipt)
        issue = draft(
            session, int(product["id"]), kind="STOCK_ISSUE", agency_id=int(agency.json()["id"])
        )
        # Backdated history: acceptance cannot move after this issue.
        session.execute(
            text("UPDATE dms.document SET \"businessDate\"='2026-01-02' WHERE id=:id"),
            {"id": issue},
        )
        post_stock(session, issue)
        session.commit()
    current = client.get(detail)
    assert current.json()["debt"] == "102" and current.json()["maxDebt"] is not None
    assert (
        client.patch(
            detail, json={"typeId": low_type}, headers={"If-Match": current.headers["ETag"]}
        ).status_code
        == 409
    )
    assert (
        client.patch(
            detail,
            json={"acceptedDate": "2026-01-03"},
            headers={"If-Match": current.headers["ETag"]},
        ).status_code
        == 409
    )
    assert client.delete(detail, headers={"If-Match": current.headers["ETag"]}).status_code == 409
    filtered = client.get(
        path,
        params={
            "q": "Same",
            "code": current.json()["code"],
            "typeId": 1,
            "wardId": destination,
            "status": "ACTIVE",
            "debtFrom": "102",
            "debtTo": "102",
            "acceptedFrom": "2025-01-01",
            "acceptedTo": "2025-01-02",
        },
    )
    assert filtered.json()["items"] == [current.json()]
    assert client.get(path, params={"debtFrom": "2", "debtTo": "1"}).status_code == 422
    assert (
        client.get(
            path, params={"acceptedFrom": "2026-01-01", "acceptedTo": "2026-01-01"}
        ).status_code
        == 422
    )
    assert client.get(path, params={"phone": "123"}).json()["items"] == []
    owing = client.post(
        detail + "/terminate",
        json={"reason": "End with debt"},
        headers={"If-Match": current.headers["ETag"]},
    )
    assert owing.status_code == 409 and owing.json()["code"] == "AGENCY_HAS_DEBT"
    assert owing.json()["details"] == {"debt": "102"}
    with Session(engine) as session:
        install_builders(session, actor)
        payment(session, int(agency.json()["id"]), 102)
        session.commit()
    settled = client.get(detail)
    assert settled.json()["debt"] == "0"
    result = client.post(
        detail + "/terminate",
        json={"reason": "End"},
        headers={"If-Match": settled.headers["ETag"]},
    )
    assert result.status_code == 200 and result.json()["debt"] == "0"
    assert result.json()["status"] == "TERMINATED" and result.json()["terminatedAt"] is not None
    assert (
        client.patch(
            detail, json={"status": "ACTIVE"}, headers={"If-Match": result.headers["ETag"]}
        ).status_code
        == 422
    )
    assert (
        client.patch(
            detail, json={"name": "Still collectible"}, headers={"If-Match": result.headers["ETag"]}
        ).status_code
        == 200
    )
    for command in (
        "DELETE FROM dms.agency WHERE id=:id",
        "UPDATE dms.agency SET debt=1 WHERE id=:id",
    ):
        with pytest.raises(DBAPIError), engine.begin() as c:
            c.execute(text(command), {"id": int(agency.json()["id"])})
    # Active capacity is enforced by the actual API, not merely SQL fixtures.
    rule = client.get("/api/v1/business-rules")
    assert (
        client.patch(
            "/api/v1/business-rules",
            json={"maxAgenciesPerWard": 1},
            headers={"If-Match": rule.headers["ETag"]},
        ).status_code
        == 200
    )
    assert client.post(path, json=body).status_code == 201
    full = client.post(path, json=body)
    assert full.status_code == 409 and full.json()["code"] == "WARD_CAPACITY_EXCEEDED"
    assert full.json()["details"] == {
        "wardId": body["wardId"],
        "activeAgencyCount": 1,
        "maxAgencies": 1,
    }
