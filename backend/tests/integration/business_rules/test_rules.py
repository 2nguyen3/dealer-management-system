from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.business_rules.schemas import BusinessRuleUpdate
from app.modules.business_rules.service import BusinessRuleService
from tests.support.contract import assert_schema
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


def test_rules_same_etag_updates_have_one_winner(client, engine, actor):
    current = client.get("/api/v1/business-rules")
    barrier = Barrier(2)

    def update(rate):
        with Session(engine) as session:
            svc = BusinessRuleService(
                session, CursorCodec(b"x" * 32), actor, "rules-race", lambda _: None
            )
            barrier.wait(timeout=race_timeout(5))
            try:
                svc.update(
                    BusinessRuleUpdate(sellingPriceRate=rate),
                    Preconditions(current.headers["ETag"]),
                )
                return "updated"
            except ApiError as error:
                return error.code

    with ThreadPoolExecutor(2) as pool:
        assert sorted(pool.map(update, ["2", "3"])) == ["PRECONDITION_FAILED", "updated"]
    with engine.connect() as c:
        assert (
            c.exec_driver_sql(
                "SELECT count(*) FROM dms.audit_log WHERE \"requestId\"='rules-race'"
            ).scalar()
            == 1
        )


def test_rules_contract_validation_state_rollback(client, engine, actor):
    path = "/api/v1/business-rules"
    original = client.get(path)
    assert original.status_code == 200
    assert_schema(original.json(), "BusinessRule")
    for body in (
        {},
        {"sellingPriceRate": None},
        {"sellingPriceRate": 1.02},
        {"sellingPriceRate": "0"},
        {"sellingPriceRate": "1000"},
        {"sellingPriceRate": "1.0000001"},
        {"maxAgenciesPerDistrict": 0},
        {"maxAgenciesPerDistrict": 2147483648},
        {"id": True},
    ):
        assert (
            client.patch(
                path, json=body, headers={"If-Match": original.headers["ETag"]}
            ).status_code
            == 422
        )
    assert client.patch(path, json={"sellingPriceRate": "2"}).status_code == 428
    updated = client.patch(
        path, json={"sellingPriceRate": "2"}, headers={"If-Match": original.headers["ETag"]}
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["sellingPriceRate"] == "2"
    assert_schema(updated.json(), "BusinessRule")
    assert (
        client.patch(
            path, json={"sellingPriceRate": "3"}, headers={"If-Match": original.headers["ETag"]}
        ).status_code
        == 412
    )
    with Session(engine) as session:
        svc = BusinessRuleService(
            session, CursorCodec(b"x" * 32), actor, "rules-rollback", lambda _: None
        )
        with patch.object(session, "commit", side_effect=RuntimeError("forced")):
            with pytest.raises(RuntimeError):
                svc.update(
                    BusinessRuleUpdate(sellingPriceRate="3"), Preconditions(updated.headers["ETag"])
                )
    assert client.get(path).json() == updated.json()
    with engine.connect() as c:
        assert (
            c.exec_driver_sql(
                "SELECT count(*) FROM dms.audit_log WHERE \"requestId\"='rules-rollback'"
            ).scalar()
            == 0
        )
        assert c.execute(
            text(
                "SELECT \"oldData\"->>'sellingPriceRate',\"newData\"->>'sellingPriceRate' "
                'FROM dms.audit_log WHERE "requestId"=:id'
            ),
            {"id": updated.headers["X-Request-Id"]},
        ).one() == ("1.02", "2")
    district = client.post("/api/v1/districts", json={"code": "CAP", "name": "Cap"}).json()["id"]
    with engine.begin() as c:
        for index in range(2):
            c.execute(
                text(
                    'INSERT INTO dms.agency(name,"typeId","districtId",email,"acceptedDate") '
                    "VALUES (:name,1,:district,'agency@example.com','2026-01-01')"
                ),
                {"name": str(index), "district": district},
            )
    rejected = client.patch(
        path, json={"maxAgenciesPerDistrict": 1}, headers={"If-Match": updated.headers["ETag"]}
    )
    assert (
        rejected.status_code == 409
        and rejected.json()["details"]["blockedDistricts"][0]["activeAgencyCount"] == 2
    )
    accepted = client.patch(
        path, json={"maxAgenciesPerDistrict": 2}, headers={"If-Match": updated.headers["ETag"]}
    )
    assert accepted.status_code == 200
    assert client.post(path, json={}).status_code == 405 and client.delete(path).status_code == 405
