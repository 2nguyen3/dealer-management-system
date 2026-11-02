import json
from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.modules.audit_logs.schemas import exact_json, project_snapshot
from app.modules.audit_logs.service import AuditService
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_nested_number_precision_actor_keys_and_provider_redaction():
    raw = (
        '{"verifiedBy":9007199254740993,"confirmedBy":9007199254740993,'
        '"readyBy":9007199254740993,"postedBy":9007199254740993,'
        '"cancelledBy":9007199254740993,"verifiedPayload":{"number":9007199254740993.125,'
        '"access_token":"sentinel","clientSecret":"sentinel",'
        '"nested":[{"Authorization":"sentinel","api_key":"sentinel"}]}}'
    )
    projected = project_snapshot("upfront_confirmation", raw)
    for key in ("verifiedBy", "confirmedBy", "readyBy", "postedBy", "cancelledBy"):
        assert projected[key] == "9007199254740993"
    rendered = exact_json(projected)
    assert "sentinel" not in rendered
    assert json.loads(rendered, parse_float=Decimal)["verifiedPayload"]["number"] == Decimal(
        "9007199254740993.125"
    )
    with pytest.raises(ValueError):
        exact_json(Decimal("NaN"))


def test_exact_nested_json_over_real_http(client, engine):
    with engine.begin() as c:
        identifier = c.scalar(
            text(
                'INSERT INTO dms.audit_log("actorType","functionCode",action,"entityName",'
                "\"entityKey\",\"newData\") VALUES ('SYSTEM','cash.upfront.verify','INSERT',"
                "'upfront_confirmation','precision',CAST(:data AS jsonb)) RETURNING id"
            ),
            {
                "data": '{"verifiedBy":9007199254740993,"verifiedPayload":'
                '{"amount":9007199254740993.125,"refresh_token":"sentinel"}}'
            },
        )
    response = client.get("/api/v1/audit-logs/" + str(identifier))
    assert response.status_code == 200 and "sentinel" not in response.text
    data = json.loads(response.text, parse_float=Decimal)["newData"]
    assert data["verifiedBy"] == "9007199254740993"
    assert data["verifiedPayload"]["amount"] == Decimal("9007199254740993.125")


def test_exact_projection():
    raw = (
        '{"id":9007199254740993,"unitId":1,"quantity":1.125,'
        '"unitPrice":600000000000000000,"basePurchasePrice":null,'
        '"notes":{"quantity":2,"password":"sentinel","values":[true,1.5,null]}}'
    )
    snapshot = project_snapshot("document_line", raw)
    assert snapshot["id"] == "9007199254740993" and snapshot["unitId"] == 1
    assert snapshot["quantity"] == "1.125" and snapshot["unitPrice"] == "600000000000000000"
    assert snapshot["basePurchasePrice"] is None
    assert snapshot["notes"] == {"quantity": 2, "values": [True, 1.5, None]}
    assert project_snapshot("unit", '{"id":1,"allowsFraction":false}') == {
        "id": 1,
        "allowsFraction": False,
    }
    assert project_snapshot("custom", '{"id":2}') == {"id": 2}
    assert project_snapshot("business_rule", '{"id":true,"sellingPriceRate":1.020000}') == {
        "id": True,
        "sellingPriceRate": "1.02",
    }
    assert project_snapshot(
        "agency", '{"createdBy":1,"businessOrder":2,"passwordHash":"sentinel"}'
    ) == {"createdBy": "1", "businessOrder": "2"}


def test_read_filters_ties_immutable_and_authorization(client, engine, actor):
    client._transport.raise_server_exceptions = True
    created = client.post("/api/v1/units", json={"code": "AUDIT", "name": "Audit"})
    request = created.headers["X-Request-Id"]
    with Session(engine) as session:
        AuditService(session, CursorCodec(b"x" * 32), actor, request, lambda _: None).list(
            actorId=str(actor)
        )
    page = client.get(
        "/api/v1/audit-logs",
        params={
            "actorId": str(actor),
            "actorType": "USER",
            "functionCode": "unit.manage",
            "action": "INSERT",
            "entityName": "unit",
            "entityKey": str(created.json()["id"]),
            "requestId": request,
            "createdFrom": "2000-01-01T00:00:00Z",
            "createdTo": "2100-01-01T00:00:00Z",
        },
    )
    assert page.status_code == 200, page.text
    assert_schema(page.json(), "AuditListResponse")
    entry = page.json()["items"][0]
    assert entry["oldData"] is None and entry["newData"]["id"] == created.json()["id"]
    detail = client.get("/api/v1/audit-logs/" + entry["id"])
    assert detail.json() == entry
    assert_schema(detail.json(), "AuditLog")
    assert client.get("/api/v1/audit-logs/9999999").status_code == 404
    assert (
        client.get(
            "/api/v1/audit-logs",
            params={"createdFrom": entry["createdAt"], "createdTo": entry["createdAt"]},
        ).status_code
        == 422
    )
    assert (
        client.get(
            "/api/v1/audit-logs", params={"createdTo": entry["createdAt"], "requestId": request}
        ).json()["items"]
        == []
    )
    with engine.begin() as c:
        for _ in range(3):
            c.execute(
                text(
                    'INSERT INTO dms.audit_log("actorType","functionCode",action,"entityName",'
                    '"entityKey","newData","createdAt","updatedAt") '
                    "VALUES ('SYSTEM','unit.manage','INSERT','unit','ties',"
                    "CAST(:data AS jsonb),'2026-01-01','2026-01-01')"
                ),
                {"data": json.dumps({"id": 1, "tokenDigest": "sentinel"})},
            )
    for sort in ("id", "-id", "createdAt", "-createdAt"):
        ids = []
        params = {"entityKey": "ties", "sort": sort, "limit": 1}
        while True:
            page = client.get("/api/v1/audit-logs", params=params).json()
            ids.extend(item["id"] for item in page["items"])
            assert "sentinel" not in str(page)
            if not page["pagination"]["hasMore"]:
                break
            params["cursor"] = page["pagination"]["nextCursor"]
        assert len(ids) == len(set(ids)) == 3
    for verb in (
        "UPDATE dms.audit_log SET \"entityKey\"='changed' WHERE id=:id",
        "DELETE FROM dms.audit_log WHERE id=:id",
    ):
        with pytest.raises(DBAPIError), engine.begin() as c:
            c.execute(text(verb), {"id": int(entry["id"])})
    for method in (client.patch, client.delete):
        assert method("/api/v1/audit-logs/" + entry["id"]).status_code == 405
    with engine.begin() as c:
        c.exec_driver_sql(
            'UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1 '
            "AND \"functionId\"=(SELECT id FROM dms.app_function WHERE code='audit.read')"
        )
    assert client.get("/api/v1/audit-logs").status_code == 403
    client.headers.pop("Authorization")
    assert client.get("/api/v1/audit-logs").status_code == 401


def test_concurrent_append_does_not_repeat_consumed_keyset(client, engine):
    with engine.begin() as c:
        for _ in range(3):
            c.exec_driver_sql(
                'INSERT INTO dms.audit_log("actorType","functionCode",action,"entityName",'
                '"entityKey","createdAt","updatedAt") '
                "VALUES ('SYSTEM','unit.manage','INSERT','unit','append','2026-01-01','2026-01-01')"
            )
    first = client.get(
        "/api/v1/audit-logs", params={"entityKey": "append", "limit": 1, "sort": "-createdAt"}
    ).json()
    # Commit an independent append between requests at the same timestamp/ID tie.
    with engine.begin() as c:
        c.exec_driver_sql(
            'INSERT INTO dms.audit_log("actorType","functionCode",action,"entityName",'
            '"entityKey","createdAt","updatedAt") '
            "VALUES ('SYSTEM','unit.manage','INSERT','unit','append','2026-01-01','2026-01-01')"
        )
    following = client.get(
        "/api/v1/audit-logs",
        params={
            "entityKey": "append",
            "limit": 100,
            "sort": "-createdAt",
            "cursor": first["pagination"]["nextCursor"],
        },
    ).json()
    assert len(following["items"]) == 2
    assert first["items"][0]["id"] not in {item["id"] for item in following["items"]}
