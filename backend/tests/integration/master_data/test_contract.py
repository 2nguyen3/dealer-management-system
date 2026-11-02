from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.modules.agencies.schemas import AgencyCreate, AgencyUpdate
from app.modules.agencies.service import AgencyService
from app.modules.products.schemas import ProductCreate, ProductUpdate
from app.modules.products.service import ProductService
from tests.auth.test_http import assert_schema_constraints
from tests.support.contract import SOURCE, assert_schema, resolve

pytestmark = pytest.mark.integration
CASES = {
    "products": (ProductService, ProductCreate, ProductUpdate, "Product"),
    "agencies": (AgencyService, AgencyCreate, AgencyUpdate, "Agency"),
}


def body_for(resource, masters):
    district, unit = masters
    return (
        {"name": "Same", "unitId": unit}
        if resource == "products"
        else {
            "name": "Same",
            "typeId": 1,
            "districtId": district,
            "email": "same@example.com",
            "acceptedDate": "2026-01-01",
        }
    )


@pytest.mark.parametrize("resource", list(CASES))
def test_crud_state_contract_errors_and_rollback(client, engine, actor, masters, resource):
    kind, create_model, update_model, schema = CASES[resource]
    body = body_for(resource, masters)
    path = "/api/v1/" + resource
    first = client.post(path, json=body)
    assert first.status_code == 201, first.text
    assert_schema(first.json(), schema)
    second = client.post(path, json=body)
    assert second.status_code == 201 and first.json()["id"] != second.json()["id"]
    detail = first.headers["Location"]
    assert client.get(detail).json() == first.json()
    assert client.patch(detail, json={"name": "Next"}).status_code == 428
    changed = client.patch(
        detail, json={"name": "Next"}, headers={"If-Match": first.headers["ETag"]}
    )
    assert changed.status_code == 200, changed.text
    assert_schema(changed.json(), schema)
    assert (
        client.patch(
            detail, json={"name": "Next"}, headers={"If-Match": first.headers["ETag"]}
        ).status_code
        == 412
    )
    for invalid in (
        {},
        {"name": None},
        {"code": "INJECT"},
        {"currentStock": "1"},
        {"currentDebt": "1"},
    ):
        assert (
            client.patch(
                detail, json=invalid, headers={"If-Match": changed.headers["ETag"]}
            ).status_code
            == 422
        )
    assert client.get(path + "/999999").status_code == 404
    assert (
        client.patch(path + "/999999", json={"name": "x"}, headers={"If-Match": '"x"'}).status_code
        == 404
    )
    assert client.delete(path + "/999999", headers={"If-Match": '"x"'}).status_code == 404
    for invalid_id in ("0", "01", "9223372036854775808"):
        assert client.get(path + "/" + invalid_id).status_code == 422
    for sort in kind.sorts:
        page = client.get(path, params={"sort": sort, "limit": 1}).json()
        next_page = client.get(
            path, params={"sort": sort, "limit": 1, "cursor": page["pagination"]["nextCursor"]}
        )
        assert next_page.status_code == 200 and next_page.json()["items"][0] != page["items"][0]
        assert_schema(next_page.json(), schema + "ListResponse")
    with Session(engine) as session:
        service = kind(session, CursorCodec(b"x" * 32), actor, "master-rollback", lambda _: None)
        with patch.object(session, "commit", side_effect=RuntimeError("forced")):
            for mutation in (
                lambda: service.create(create_model.model_validate(body)),
                lambda: service.update(
                    int(first.json()["id"]),
                    update_model(name="Rollback"),
                    Preconditions(changed.headers["ETag"]),
                ),
                lambda: service.delete(
                    int(first.json()["id"]), Preconditions(changed.headers["ETag"])
                ),
            ):
                with pytest.raises(RuntimeError):
                    mutation()
    assert client.get(detail).json() == changed.json()
    removed = client.delete(detail, headers={"If-Match": changed.headers["ETag"]})
    assert removed.status_code == 204 and not removed.content
    assert client.get(detail).status_code == 404
    with engine.connect() as c:
        cache = "inventory_balance" if resource == "products" else "agency_balance"
        owner = "productId" if resource == "products" else "agencyId"
        assert (
            c.execute(
                text(f'SELECT count(*) FROM dms.{cache} WHERE "{owner}"=:id'),
                {"id": int(first.json()["id"])},
            ).scalar()
            == 0
        )
        assert (
            c.exec_driver_sql(
                "SELECT count(*) FROM dms.audit_log WHERE \"requestId\"='master-rollback'"
            ).scalar()
            == 0
        )
    new = client.post(path, json=body)
    assert int(new.json()["id"]) > int(second.json()["id"])


def test_all_new_operations_exact_runtime_contract(client):
    runtime = client.get("/api/openapi.json").json()
    owned = {"Permissions", "Audit Logs", "Business Rules", "Products", "Agencies"}
    count = 0
    for path, methods in SOURCE["paths"].items():
        for method, expected in methods.items():
            if method == "parameters" or not owned.intersection(expected["tags"]):
                continue
            count += 1
            actual = runtime["paths"]["/api/v1" + path][method]
            assert actual["operationId"] == expected["operationId"]
            assert set(actual["responses"]) == set(expected["responses"])
            assert actual["security"] == [{"BearerAuth": []}]
            assert actual["x-permissions"] == expected["x-permissions"]
            parameters = {p["name"]: p for p in actual.get("parameters", [])}
            for parameter in methods.get("parameters", []) + expected.get("parameters", []):
                definition = resolve(parameter)
                generated = parameters[definition["name"]]
                assert generated["required"] == definition.get("required", False)
                schema = generated["schema"]
                if "anyOf" in schema:
                    schema = next(s for s in schema["anyOf"] if s.get("type") != "null")
                assert_schema_constraints(definition["schema"], schema, SOURCE, runtime)
            for status, response in expected["responses"].items():
                source = resolve(response)
                for header, definition in source.get("headers", {}).items():
                    assert_schema_constraints(
                        resolve(definition)["schema"],
                        actual["responses"][status]["headers"][header]["schema"],
                        SOURCE,
                        runtime,
                    )
                if "content" in source:
                    assert_schema_constraints(
                        source["content"]["application/json"]["schema"],
                        actual["responses"][status]["content"]["application/json"]["schema"],
                        SOURCE,
                        runtime,
                    )
            if "requestBody" in expected:
                assert_schema_constraints(
                    resolve(expected["requestBody"])["content"]["application/json"]["schema"],
                    actual["requestBody"]["content"]["application/json"]["schema"],
                    SOURCE,
                    runtime,
                )
    assert count == 20


def test_termination_key_replay_state_and_rollback(client, engine, actor, masters):
    created = client.post("/api/v1/agencies", json=body_for("agencies", masters))
    path = created.headers["Location"] + "/terminate"
    headers = {"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())}
    result = client.post(path, json={"reason": "End"}, headers=headers)
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "TERMINATED"
    assert_schema(result.json(), "Agency")
    retry = client.post(path, json={"reason": "End"}, headers=headers)
    assert retry.json() == result.json() and retry.headers["ETag"] == result.headers["ETag"]
    assert client.post(path, json={"reason": "Other"}, headers=headers).status_code == 409
    assert (
        client.post(
            path,
            json={"reason": "End"},
            headers={"If-Match": result.headers["ETag"], "Idempotency-Key": str(uuid4())},
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/api/v1/agencies/999999/terminate", json={"reason": "End"}, headers=headers
        ).status_code
        == 404
    )
    assert (
        client.post(
            path, json={"reason": "End"}, headers={"Idempotency-Key": str(uuid4())}
        ).status_code
        == 428
    )
    active = client.post("/api/v1/agencies", json=body_for("agencies", masters))
    with Session(engine) as session:
        svc = AgencyService(
            session, CursorCodec(b"x" * 32), actor, "termination-rollback", lambda _: None
        )
        with patch.object(session, "commit", side_effect=RuntimeError("forced")):
            with pytest.raises(RuntimeError):
                from app.modules.agencies.schemas import Reason

                svc.terminate(
                    int(active.json()["id"]),
                    Reason(reason="End"),
                    Preconditions(active.headers["ETag"]),
                    uuid4(),
                )
    assert client.get(active.headers["Location"]).json()["status"] == "ACTIVE"
    with engine.connect() as c:
        assert (
            c.exec_driver_sql(
                "SELECT count(*) FROM dms.audit_log WHERE \"requestId\"='termination-rollback'"
            ).scalar()
            == 0
        )
        assert c.exec_driver_sql("SELECT count(*) FROM dms.api_idempotency").scalar() == 1
