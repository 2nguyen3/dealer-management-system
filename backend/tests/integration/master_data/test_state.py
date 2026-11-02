from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from tests.integration.catalogues.helpers import count_line, draft, install_builders, post_stock
from tests.integration.master_data.test_contract import body_for
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_product_unit_threshold_ranges_price_source_and_d16(client, engine, actor, masters):
    path = "/api/v1/products"
    created = client.post(path, json={**body_for("products", masters), "lowStockThreshold": "1"})
    assert created.status_code == 201, created.text
    detail = created.headers["Location"]
    assert created.json()["isLowStock"] and created.json()["priceSource"] is None
    missing = client.post(path, json={"name": "x", "unitId": 999999})
    assert missing.status_code == 404
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
    # Re-enable for a genuine persisted near-limit receipt; no cache manipulation.
    unit_detail = client.get("/api/v1/units/" + str(unit))
    client.patch(
        "/api/v1/units/" + str(unit),
        json={"status": "ACTIVE"},
        headers={"If-Match": unit_detail.headers["ETag"]},
    )
    with Session(engine) as session:
        install_builders(session, actor)
        document = draft(session, int(created.json()["id"]))
        session.execute(
            text(
                'UPDATE dms.document_line SET "unitPrice"=600000000000000000 '
                'WHERE "revisionId"=(SELECT "currentRevisionId" FROM dms.document WHERE id=:id)'
            ),
            {"id": document},
        )
        session.execute(
            text(
                'UPDATE dms.document_revision SET "totalAmount"=600000000000000000 '
                'WHERE id=(SELECT "currentRevisionId" FROM dms.document WHERE id=:id)'
            ),
            {"id": document},
        )
        post_stock(session, document)
        session.commit()
        old_lines = session.execute(
            text(
                'SELECT id,"unitPrice","productName","unitName" FROM dms.document_line ORDER BY id'
            )
        ).all()
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
    assert product.json()["currentStock"] == "1" and not product.json()["isLowStock"]
    assert product.json()["currentSellingPrice"] == "1200000000000000000"
    assert product.json()["priceSource"]["documentId"] == str(document)
    assert_schema(product.json(), "Product")
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
            "isLowStock": False,
            "stockFrom": "1",
            "stockTo": "1",
        },
    )
    assert filtered.json()["items"] == [product.json()]
    assert client.get(path, params={"stockFrom": "2", "stockTo": "1"}).status_code == 422
    assert client.get(path, params={"stockFrom": "1.0001"}).status_code == 422
    # A second valid receipt with price 1 and the smallest valid rate rounds to zero.
    small = client.post(path, json={"name": "Small", "unitId": unit}).json()
    with Session(engine) as session:
        install_builders(session, actor)
        doc = draft(session, int(small["id"]))
        session.execute(
            text(
                'UPDATE dms.document_line SET "unitPrice"=1 '
                'WHERE "revisionId"=(SELECT "currentRevisionId" FROM dms.document WHERE id=:id)'
            ),
            {"id": doc},
        )
        session.execute(
            text(
                'UPDATE dms.document_revision SET "totalAmount"=1 '
                'WHERE id=(SELECT "currentRevisionId" FROM dms.document WHERE id=:id)'
            ),
            {"id": doc},
        )
        post_stock(session, doc)
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
    assert client.get("/api/v1/products/" + small["id"]).json()["currentSellingPrice"] == "0"
    with engine.connect() as c:
        assert (
            c.execute(
                text(
                    'SELECT id,"unitPrice","productName","unitName" FROM dms.document_line '
                    "WHERE id IN (SELECT id FROM dms.document_line ORDER BY id LIMIT 1)"
                )
            ).all()
            == old_lines
        )
    with Session(engine) as session:
        install_builders(session, actor)
        session.execute(text("SET CONSTRAINTS ALL DEFERRED"))
        session.execute(text("SELECT pg_temp.reverse_stock(:id)"), {"id": document})
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()
    canceled = client.get(detail)
    assert canceled.json()["currentStock"] == "0" and canceled.json()["priceSource"] is None
    assert client.delete(detail, headers={"If-Match": canceled.headers["ETag"]}).status_code == 409


def test_recorded_count_product_and_direct_cache_denial(client, engine, actor, masters):
    product = client.post("/api/v1/products", json=body_for("products", masters))
    path = product.headers["Location"]
    with Session(engine) as session:
        count_line(session, actor, int(product.json()["id"]), masters[1])
        session.commit()
    other = client.post("/api/v1/units", json={"code": "SECOND", "name": "Second"}).json()["id"]
    assert (
        client.patch(
            path, json={"unitId": other}, headers={"If-Match": product.headers["ETag"]}
        ).status_code
        == 409
    )
    assert client.delete(path, headers={"If-Match": product.headers["ETag"]}).status_code == 409
    for cache, owner, values in (("inventory_balance", "productId", '"currentStock"=1'),):
        for command in (
            f'DELETE FROM dms.{cache} WHERE "{owner}"=:id',
            f'UPDATE dms.{cache} SET {values} WHERE "{owner}"=:id',
        ):
            with pytest.raises(DBAPIError), engine.begin() as c:
                c.execute(text(command), {"id": int(product.json()["id"])})


def test_agency_master_capacity_contact_history_type_debt_and_termination(
    client, engine, actor, masters
):
    path = "/api/v1/agencies"
    body = body_for("agencies", masters)
    for invalid in ({"typeId": 99999}, {"districtId": 99999}):
        assert client.post(path, json={**body, **invalid}).status_code == 404
    inactive_type = client.post(
        "/api/v1/agency-types",
        json={"code": "OFF", "name": "Off", "maxDebt": "0", "status": "INACTIVE"},
    ).json()["id"]
    inactive_district = client.post(
        "/api/v1/districts", json={"code": "OFF", "name": "Off", "status": "INACTIVE"}
    ).json()["id"]
    assert client.post(path, json={**body, "typeId": inactive_type}).status_code == 409
    assert client.post(path, json={**body, "districtId": inactive_district}).status_code == 409
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
    destination = client.post(
        "/api/v1/districts", json={"code": "DEST", "name": "Destination"}
    ).json()["id"]
    moved = client.patch(
        detail,
        json={"typeId": low_type, "districtId": destination},
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
        post_stock(session, issue)
        session.commit()
    current = client.get(detail)
    assert current.json()["currentDebt"] == "102"
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
            "districtId": destination,
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
    result = client.post(
        detail + "/terminate",
        json={"reason": "End with debt"},
        headers={"If-Match": current.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert result.status_code == 200 and result.json()["currentDebt"] == "102"
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
        'DELETE FROM dms.agency_balance WHERE "agencyId"=:id',
        'UPDATE dms.agency_balance SET "currentDebt"=0 WHERE "agencyId"=:id',
    ):
        with pytest.raises(DBAPIError), engine.begin() as c:
            c.execute(text(command), {"id": int(agency.json()["id"])})
    # Active capacity is enforced by the actual API, not merely SQL fixtures.
    rule = client.get("/api/v1/business-rules")
    assert (
        client.patch(
            "/api/v1/business-rules",
            json={"maxAgenciesPerDistrict": 1},
            headers={"If-Match": rule.headers["ETag"]},
        ).status_code
        == 200
    )
    assert client.post(path, json=body).status_code == 201
    assert client.post(path, json=body).status_code == 409
