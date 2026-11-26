import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.modules.agencies.service import AgencyService
from tests.integration.catalogues.helpers import draft, install_builders, post_stock
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.master_data.test_contract import body_for

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("leading", ["reference", "delete"])
def test_agency_delete_vs_draft_reference_both_orders(client, engine, actor, masters, leading):
    created = client.post("/api/v1/agencies", json=body_for("agencies", masters))
    product = client.post("/api/v1/products", json=body_for("products", masters))
    identifier = int(created.json()["id"])
    with Session(engine) as session:
        install_builders(session, actor)
        receipt = draft(session, int(product.json()["id"]), quantity="10")
        post_stock(session, receipt)
        session.commit()

    def reference(session):
        install_builders(session, actor)
        identifier_doc = draft(
            session, int(product.json()["id"]), kind="STOCK_ISSUE", agency_id=identifier
        )
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()
        return identifier_doc

    def delete(session):
        service = AgencyService(
            session, CursorCodec(b"x" * 32), actor, "agency-delete-race", lambda _: None
        )
        service.delete(identifier, Preconditions(created.headers["ETag"]))
        return "deleted"

    first, second = ordered_race(
        engine,
        reference if leading == "reference" else delete,
        delete if leading == "reference" else reference,
    )
    if leading == "reference":
        # The newly referenced agency's representation (canDelete) has changed.
        assert isinstance(first, int) and second == "PRECONDITION_FAILED"
    else:
        assert first == "deleted" and second == "MASTER_CONFLICT"
    with Session(engine) as session:
        assert session.scalar(
            text("SELECT count(*) FROM dms.agency WHERE id=:id"), {"id": identifier}
        ) == (1 if leading == "reference" else 0)


def test_agency_delete_eligibility_and_physical_removal(client, engine, actor, masters):
    unused = client.post("/api/v1/agencies", json=body_for("agencies", masters))
    unused_id = unused.json()["id"]
    assert unused.json()["canDelete"] is True
    deleted = client.delete(
        unused.headers["Location"], headers={"If-Match": unused.headers["ETag"]}
    )
    assert deleted.status_code == 204
    assert client.get(unused.headers["Location"]).status_code == 404
    listed = client.get("/api/v1/agencies").json()["items"]
    assert all(row["id"] != unused_id for row in listed)

    used = client.post("/api/v1/agencies", json=body_for("agencies", masters))
    product = client.post("/api/v1/products", json=body_for("products", masters))
    with Session(engine) as session:
        install_builders(session, actor)
        receipt = draft(session, int(product.json()["id"]), quantity="10")
        post_stock(session, receipt)
        draft(
            session,
            int(product.json()["id"]),
            kind="STOCK_ISSUE",
            agency_id=int(used.json()["id"]),
        )
        session.commit()
    current = client.get(used.headers["Location"])
    assert current.json()["canDelete"] is False
    blocked = client.delete(used.headers["Location"], headers={"If-Match": current.headers["ETag"]})
    assert blocked.status_code == 409 and blocked.json()["code"] == "RESOURCE_IN_USE"
