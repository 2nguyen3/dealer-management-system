from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.modules.agencies.schemas import AgencyCreate, AgencyUpdate, Reason
from app.modules.agencies.service import AgencyService
from app.modules.agency_types.schemas import AgencyTypeUpdate
from app.modules.agency_types.service import AgencyTypeService
from app.modules.business_rules.schemas import BusinessRuleUpdate
from app.modules.business_rules.service import BusinessRuleService
from app.modules.districts.schemas import DistrictUpdate
from app.modules.districts.service import DistrictService
from app.modules.products.schemas import ProductCreate, ProductUpdate
from app.modules.products.service import ProductService
from app.modules.units.schemas import UnitUpdate
from app.modules.units.service import UnitService
from tests.integration.catalogues.helpers import draft, install_builders, post_stock
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.master_data.test_contract import body_for

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("resource", ["unit", "district"])
@pytest.mark.parametrize("leading", ["inactivate", "assign"])
def test_actual_assignment_vs_master_inactivation_both_orders(
    client, engine, actor, masters, resource, leading
):
    if resource == "unit":
        current = client.get("/api/v1/units/" + str(masters[1]))

        def inactivate(session):
            return service(UnitService, session, actor).update(
                masters[1], UnitUpdate(status="INACTIVE"), Preconditions(current.headers["ETag"])
            )

        def assign(session):
            return service(ProductService, session, actor).create(
                ProductCreate.model_validate(body_for("products", masters))
            )
    else:
        current = client.get("/api/v1/districts/" + str(masters[0]))

        def inactivate(session):
            return service(DistrictService, session, actor).update(
                masters[0],
                DistrictUpdate(status="INACTIVE"),
                Preconditions(current.headers["ETag"]),
            )

        def assign(session):
            return service(AgencyService, session, actor).create(
                AgencyCreate.model_validate(body_for("agencies", masters))
            )

    first, second = ordered_race(
        engine,
        inactivate if leading == "inactivate" else assign,
        assign if leading == "inactivate" else inactivate,
    )
    if leading == "inactivate":
        assert first.status == "INACTIVE" and second == "INACTIVE_MASTER"
    else:
        assert first.status == "ACTIVE" and second == "PRECONDITION_FAILED"


def service(kind, session, actor):
    return kind(session, CursorCodec(b"x" * 32), actor, "master-race", lambda _: None)


def test_last_slot_and_rule_lowering_both_orders(client, engine, actor, masters):
    body = AgencyCreate.model_validate(body_for("agencies", masters))
    rules = client.get("/api/v1/business-rules")
    client.patch(
        "/api/v1/business-rules",
        json={"maxAgenciesPerDistrict": 1},
        headers={"If-Match": rules.headers["ETag"]},
    )
    first, second = ordered_race(
        engine,
        lambda s: service(AgencyService, s, actor).create(body),
        lambda s: service(AgencyService, s, actor).create(body),
    )
    assert first.status == "ACTIVE" and second == "DISTRICT_CAPACITY_EXCEEDED"
    rule = client.get("/api/v1/business-rules")
    raised = client.patch(
        "/api/v1/business-rules",
        json={"maxAgenciesPerDistrict": 2},
        headers={"If-Match": rule.headers["ETag"]},
    )
    match = Preconditions(raised.headers["ETag"])
    first, second = ordered_race(
        engine,
        lambda s: service(BusinessRuleService, s, actor).update(
            BusinessRuleUpdate(maxAgenciesPerDistrict=1), match
        ),
        lambda s: service(AgencyService, s, actor).create(body),
    )
    assert first.maxAgenciesPerDistrict == 1 and second == "DISTRICT_CAPACITY_EXCEEDED"
    rule = client.get("/api/v1/business-rules")
    raised = client.patch(
        "/api/v1/business-rules",
        json={"maxAgenciesPerDistrict": 2},
        headers={"If-Match": rule.headers["ETag"]},
    )
    match = Preconditions(raised.headers["ETag"])
    first, second = ordered_race(
        engine,
        lambda s: service(AgencyService, s, actor).create(body),
        lambda s: service(BusinessRuleService, s, actor).update(
            BusinessRuleUpdate(maxAgenciesPerDistrict=1), match
        ),
    )
    assert first.status == "ACTIVE" and second == "LIMIT_CONFLICT"
    with engine.connect() as c:
        assert (
            c.exec_driver_sql("SELECT count(*) FROM dms.agency WHERE status='ACTIVE'").scalar() == 2
        )


def test_opposing_moves_and_same_key_termination(client, engine, actor, masters):
    district = client.post(
        "/api/v1/districts", json={"code": "DEST", "name": "Destination"}
    ).json()["id"]
    body = body_for("agencies", masters)
    one = client.post("/api/v1/agencies", json=body)
    two = client.post("/api/v1/agencies", json={**body, "districtId": district})
    first, second = ordered_race(
        engine,
        lambda s: service(AgencyService, s, actor).update(
            int(one.json()["id"]),
            AgencyUpdate(districtId=district),
            Preconditions(one.headers["ETag"]),
        ),
        lambda s: service(AgencyService, s, actor).update(
            int(two.json()["id"]),
            AgencyUpdate(districtId=masters[0]),
            Preconditions(two.headers["ETag"]),
        ),
    )
    assert first.districtId == district and second.districtId == masters[0]
    key = uuid4()
    match = Preconditions(client.get(one.headers["Location"]).headers["ETag"])
    first, second = ordered_race(
        engine,
        lambda s: service(AgencyService, s, actor).terminate(
            int(one.json()["id"]), Reason(reason="End"), match, key
        ),
        lambda s: service(AgencyService, s, actor).terminate(
            int(one.json()["id"]), Reason(reason="End"), match, key
        ),
    )
    assert first == second and first.body["status"] == "TERMINATED"
    with engine.connect() as c:
        assert c.exec_driver_sql("SELECT count(*) FROM dms.api_idempotency").scalar() == 1


@pytest.mark.parametrize("leading", ["use", "use_delete", "unit", "delete"])
def test_product_first_use_against_unit_change_and_delete(client, engine, actor, masters, leading):
    product = client.post("/api/v1/products", json=body_for("products", masters))
    identifier = int(product.json()["id"])
    other = client.post("/api/v1/units", json={"code": "OTHER", "name": "Other"}).json()["id"]
    condition = Preconditions(product.headers["ETag"])

    def use(session):
        install_builders(session, actor)
        document = draft(session, identifier)
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()
        return document

    def change(session):
        return service(ProductService, session, actor).update(
            identifier, ProductUpdate(unitId=other), condition
        )

    def delete(session):
        service(ProductService, session, actor).delete(identifier, condition)
        return "deleted"

    if leading in ("use", "use_delete"):
        first, second = ordered_race(engine, use, change if leading == "use" else delete)
        assert isinstance(first, int) and second == (
            "USED_UNIT_IMMUTABLE" if leading == "use" else "RESOURCE_IN_USE"
        )
        # Any draft history blocks deletion even with a zero cache.
        with Session(engine) as session:
            from app.core.exceptions import ApiError

            with pytest.raises(ApiError, match="RESOURCE_IN_USE"):
                service(ProductService, session, actor).delete(identifier, condition)
    elif leading == "unit":
        first, second = ordered_race(engine, change, use)
        assert first.unitId == other and second == "23514"
    else:
        first, second = ordered_race(engine, delete, use)
        assert first == "deleted" and second in ("23503", "P0002")


def test_type_limit_move_and_termination_vs_post(client, engine, actor, masters):
    agency = client.post("/api/v1/agencies", json=body_for("agencies", masters))
    product = client.post("/api/v1/products", json=body_for("products", masters))
    with Session(engine) as session:
        install_builders(session, actor)
        receipt = draft(session, int(product.json()["id"]), quantity="10")
        post_stock(session, receipt)
        issue = draft(
            session,
            int(product.json()["id"]),
            kind="STOCK_ISSUE",
            agency_id=int(agency.json()["id"]),
        )
        post_stock(session, issue)
        pending = draft(
            session,
            int(product.json()["id"]),
            kind="STOCK_ISSUE",
            agency_id=int(agency.json()["id"]),
        )
        session.commit()
    target = client.post(
        "/api/v1/agency-types", json={"code": "TARGET", "name": "Target", "maxDebt": "200"}
    )
    current = client.get(agency.headers["Location"])
    first, second = ordered_race(
        engine,
        lambda s: service(AgencyTypeService, s, actor).update(
            target.json()["id"],
            AgencyTypeUpdate(maxDebt="100"),
            Preconditions(target.headers["ETag"]),
        ),
        lambda s: service(AgencyService, s, actor).update(
            int(agency.json()["id"]),
            AgencyUpdate(typeId=target.json()["id"]),
            Preconditions(current.headers["ETag"]),
        ),
    )
    assert first.maxDebt == 100 and second == "LIMIT_CONFLICT"

    def post(session):
        install_builders(session, actor)
        post_stock(session, pending)
        session.commit()
        return "posted"

    first, second = ordered_race(
        engine,
        lambda s: service(AgencyService, s, actor).terminate(
            int(agency.json()["id"]),
            Reason(reason="End"),
            Preconditions(current.headers["ETag"]),
            uuid4(),
        ),
        post,
    )
    assert first.body["currentDebt"] == "102" and second == "23514"


def test_rate_change_vs_receipt_source_preserves_quotes(client, engine, actor, masters):
    product = client.post("/api/v1/products", json=body_for("products", masters))
    rules = client.get("/api/v1/business-rules")
    with Session(engine) as session:
        install_builders(session, actor)
        receipt = draft(session, int(product.json()["id"]))
        session.commit()

    def post(session):
        install_builders(session, actor)
        # Receipt posting itself does not need a rule. Take the standard full
        # product-detail rule lock to verify an atomic outward quote projection.
        session.execute(text("SELECT id FROM dms.business_rule WHERE id FOR SHARE"))
        post_stock(session, receipt)
        session.commit()
        return "posted"

    first, second = ordered_race(
        engine,
        lambda s: service(BusinessRuleService, s, actor).update(
            BusinessRuleUpdate(sellingPriceRate="2"), Preconditions(rules.headers["ETag"])
        ),
        post,
    )
    assert first.sellingPriceRate == 2 and second == "posted"
    assert client.get(product.headers["Location"]).json()["currentSellingPrice"] == "200"
