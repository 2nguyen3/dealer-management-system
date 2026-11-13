"""Real-PostgreSQL tests for the read-only ward catalogue and revision 0010."""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.audit_logs.service import AuditService
from app.modules.permissions.schemas import PermissionSet
from app.modules.permissions.service import FunctionService, PermissionService
from tests.integration.catalogues.helpers import agency
from tests.support.contract import assert_schema
from tests.support.database import migrate

pytestmark = pytest.mark.integration


def service(kind, session, actor):
    return kind(session, CursorCodec(b"x" * 32), actor, "ward-test", lambda _: None)


def test_catalogue_is_loaded_exactly_and_read_only(engine):
    with engine.connect() as connection:
        counts = dict(
            connection.execute(text("SELECT kind,count(*) FROM dms.ward GROUP BY kind")).all()
        )
        assert counts == {"WARD": 113, "COMMUNE": 54, "SPECIAL_ZONE": 1}
        assert connection.execute(
            text("SELECT id,name,kind FROM dms.ward WHERE code IN ('26740','26732') ORDER BY code")
        ).all() == [(66, "Đặc khu Côn Đảo", "SPECIAL_ZONE"), (68, "Phường Sài Gòn", "WARD")]
        assert connection.scalar(text("SELECT to_regclass('dms.district')")) is None
        assert (
            connection.scalar(text("SELECT count(*) FROM dms.app_function WHERE code LIKE 'dist%'"))
            == 0
        )
    for statement, state in (
        ("INSERT INTO dms.ward (code,name,kind) VALUES ('99999','X','DISTRICT')", "23514"),
        ("INSERT INTO dms.ward (code,name,kind) VALUES ('Q1','X','WARD')", "23514"),
        ("INSERT INTO dms.ward (code,name,kind) VALUES ('26740','X','WARD')", "23505"),
        ("INSERT INTO dms.ward (code,name,kind) VALUES ('99999','Phường Sài Gòn','WARD')", "23505"),
        (
            'INSERT INTO dms.agency (name,"typeId","wardId",email,"acceptedDate") '
            "VALUES ('A',1,999,'a@example.com','2026-01-01')",
            "23503",
        ),
    ):
        with pytest.raises(DBAPIError) as error, engine.begin() as connection:
            connection.exec_driver_sql(statement)
        assert error.value.orig.sqlstate == state


def test_http_list_filters_cursor_detail_and_404(client, engine):
    path = "/api/v1/wards"
    first = client.get(path)
    assert first.status_code == 200
    assert_schema(first.json(), "WardListResponse")
    assert len(first.json()["items"]) == 25 and first.json()["pagination"]["hasMore"]
    seen, params = [], {"limit": 100}
    while True:
        page = client.get(path, params=params).json()
        seen += page["items"]
        if not page["pagination"]["hasMore"]:
            break
        params["cursor"] = page["pagination"]["nextCursor"]
    assert len(seen) == 168 and len({item["code"] for item in seen}) == 168
    assert {item["remainingSlots"] for item in seen} == {4}
    assert [
        i["kind"] for i in client.get(path, params={"kind": "SPECIAL_ZONE"}).json()["items"]
    ] == ["SPECIAL_ZONE"]
    communes = client.get(path, params={"kind": "COMMUNE", "limit": 100}).json()["items"]
    assert len(communes) == 54 and all(item["name"].startswith("Xã ") for item in communes)
    (sai_gon,) = client.get(path, params={"code": "26740"}).json()["items"]
    assert sai_gon["name"] == "Phường Sài Gòn" and set(sai_gon) >= {"kind", "createdAt"}
    assert "status" not in sai_gon
    searched = client.get(path, params={"q": "sài gòn"}).json()["items"]
    assert [item["code"] for item in searched] == ["26740"]
    assert client.get(path, params={"q": "%"}).json()["items"] == []
    names = [item["name"] for item in client.get(path, params={"sort": "-name"}).json()["items"]]
    with engine.connect() as connection:
        expected = connection.execute(
            text("SELECT name FROM dms.ward ORDER BY name DESC, id DESC LIMIT 25")
        ).scalars()
        assert names == list(expected)
    assert client.get(path, params={"cursor": "forged"}).status_code == 400
    detail = client.get(f"{path}/{sai_gon['id']}")
    assert detail.status_code == 200 and detail.json() == sai_gon
    assert_schema(detail.json(), "Ward")
    etag = detail.headers["ETag"]
    assert client.get(f"{path}/169").status_code == 404
    assert client.post(path, json={"code": "1", "name": "x"}).status_code == 405
    assert client.delete(f"{path}/{sai_gon['id']}").status_code == 405
    body = {
        "name": "Ward agency",
        "typeId": 1,
        "wardId": sai_gon["id"],
        "email": "ward@example.com",
        "acceptedDate": "2026-01-01",
    }
    created = client.post("/api/v1/agencies", json=body)
    assert created.status_code == 201 and created.json()["wardName"] == "Phường Sài Gòn"
    changed = client.get(f"{path}/{sai_gon['id']}")
    assert changed.json()["activeAgencyCount"] == 1 and changed.json()["remainingSlots"] == 3
    assert changed.headers["ETag"] != etag
    listed = client.get("/api/v1/agencies", params={"wardId": sai_gon["id"]}).json()["items"]
    assert [item["id"] for item in listed] == [created.json()["id"]]
    assert client.get("/api/v1/agencies", params={"wardId": 2}).json()["items"] == []


def test_read_permission_any_of_agency_read_or_manage(client, engine):
    def allow(codes):
        with engine.begin() as connection:
            connection.execute(
                text(
                    'UPDATE dms.group_permission p SET "isAllowed"=f.code = ANY(:codes) '
                    'FROM dms.app_function f WHERE f.id=p."functionId" AND p."groupId"=1 '
                    "AND f.code IN ('agency.read','agency.manage')"
                ),
                {"codes": codes},
            )

    try:
        for codes, status in ((["agency.read"], 200), (["agency.manage"], 200), ([], 403)):
            allow(codes)
            assert client.get("/api/v1/wards").status_code == status
            assert client.get("/api/v1/wards/1").status_code == status
    finally:
        allow(["agency.read", "agency.manage"])


def test_rule_lowering_and_ward_move_capacity(engine, actor):
    with Session(engine) as session:
        for _ in range(3):
            agency(session, ward=5)
        mover = agency(session, ward=6)
        session.commit()
    with pytest.raises(DBAPIError) as error, engine.begin() as connection:
        connection.exec_driver_sql('UPDATE dms.business_rule SET "maxAgenciesPerWard"=2')
    assert "New ward limit is below existing active count" in str(error.value.orig)
    with engine.begin() as connection:
        connection.exec_driver_sql('UPDATE dms.business_rule SET "maxAgenciesPerWard"=3')
    with pytest.raises(DBAPIError) as error, engine.begin() as connection:
        connection.execute(text('UPDATE dms.agency SET "wardId"=5 WHERE id=:id'), {"id": mover})
    assert "Ward agency capacity exceeded" in str(error.value.orig)
    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE dms.agency SET status='TERMINATED',\"terminatedAt\"=clock_timestamp(),"
                '"terminationReason"=\'End\' WHERE "wardId"=5 AND id=(SELECT min(id) '
                'FROM dms.agency WHERE "wardId"=5)'
            )
        )
        connection.execute(text('UPDATE dms.agency SET "wardId"=5 WHERE id=:id'), {"id": mover})
        assert connection.scalar(
            text('SELECT "wardName" FROM dms.agency_overview WHERE id=:id'), {"id": mover}
        ) == connection.scalar(text("SELECT name FROM dms.ward WHERE id=5"))


def seed_legacy(engine, names):
    """Write 0009-shaped district/agency rows the way the old API did (audited)."""
    with engine.begin() as connection:
        connection.exec_driver_sql("SELECT set_config('dms.function_code','district.manage',true)")
        ids = [
            connection.execute(
                text("INSERT INTO dms.district (code,name) VALUES (:code,:name) RETURNING id"),
                {"code": f"D{index}", "name": name},
            ).scalar_one()
            for index, name in enumerate(names)
        ]
        connection.exec_driver_sql("SELECT set_config('dms.function_code','agency.manage',true)")
        addresses = [
            "1 Lê Lợi, Quận 1, TP.HCM (mẫu)",
            "2 Phan Đăng Lưu, Bình Thạnh, TP.HCM",
            "Quận 1 không theo mẫu",
            None,
        ]
        for index, address in enumerate(addresses):
            connection.execute(
                text(
                    'INSERT INTO dms.agency (name,"typeId","districtId",address,email,'
                    "\"acceptedDate\") VALUES (:name,1,:district,:address,:email,'2026-01-01')"
                ),
                {
                    "name": f"Legacy {index}",
                    "district": ids[1] if index == 1 else ids[0],
                    "address": address,
                    "email": f"legacy{index}@example.com",
                },
            )
    return addresses


def test_populated_upgrade_maps_rewrites_and_downgrade_restores(database_factory):
    with database_factory("0009") as engine:
        addresses = seed_legacy(engine, ["Quận 1", "Bình Thạnh", "Nhà Bè"])
        with engine.connect() as connection:
            before_audit = connection.scalar(text("SELECT count(*) FROM dms.audit_log"))
        migrate(engine.url)
        with engine.connect() as connection:
            rows = connection.execute(
                text(
                    'SELECT a.address,w.code,w.name,o."wardName" FROM dms.agency a '
                    'JOIN dms.ward w ON w.id=a."wardId" '
                    "JOIN dms.agency_overview o ON o.id=a.id ORDER BY a.id"
                )
            ).all()
            assert rows == [
                (
                    "1 Lê Lợi, Phường Sài Gòn, TP.HCM (mẫu)",
                    "26740",
                    "Phường Sài Gòn",
                    "Phường Sài Gòn",
                ),
                (
                    "2 Phan Đăng Lưu, Phường Bình Thạnh, TP.HCM",
                    "26929",
                    "Phường Bình Thạnh",
                    "Phường Bình Thạnh",
                ),
                ("Quận 1 không theo mẫu", "26740", "Phường Sài Gòn", "Phường Sài Gòn"),
                (None, "26740", "Phường Sài Gòn", "Phường Sài Gòn"),
            ]
            assert connection.scalar(text("SELECT to_regclass('dms.district')")) is None
            assert (
                connection.scalar(text('SELECT "maxAgenciesPerWard" FROM dms.business_rule')) == 4
            )
            # Historical audit rows keep the retired code, so its function row survives,
            # but no grant remains and the application hides it everywhere.
            assert (
                connection.scalar(
                    text("SELECT count(*) FROM dms.app_function WHERE code='district.manage'")
                )
                == 1
            )
            assert (
                connection.scalar(
                    text(
                        "SELECT count(*) FROM dms.group_permission p JOIN dms.app_function f "
                        "ON f.id=p.\"functionId\" WHERE f.code='district.manage'"
                    )
                )
                == 0
            )
            migration_audit = connection.execute(
                text(
                    'SELECT "entityName",count(*) FROM dms.audit_log '
                    "WHERE \"requestId\"='alembic-0010-hcmc-wards' GROUP BY 1 ORDER BY 1"
                )
            ).all()
            assert migration_audit == [("agency", 4), ("group_permission", 4)]
            assert connection.scalar(text("SELECT count(*) FROM dms.audit_log")) == before_audit + 8
        actor = None  # Reads and the rejected grant need no persisted actor.
        with Session(engine) as session:
            functions = service(FunctionService, session, actor).list(limit=100)
            assert "district.manage" not in {item.code for item in functions.items}
            retired = session.scalar(
                text("SELECT id FROM dms.app_function WHERE code='district.manage'")
            )
            with pytest.raises(ApiError, match="NOT_FOUND"):
                service(PermissionService, session, actor).set(
                    1, retired, PermissionSet(isAllowed=True), Preconditions(None, True)
                )
            history = service(AuditService, session, actor).list(
                functionCode="district.manage", limit=100
            )
            assert {item.entityName for item in history.items} == {"district"}
            assert all(item.newData["code"].startswith("D") for item in history.items)
        migrate(engine.url, "0009", downgrade=True)
        with engine.connect() as connection:
            restored = connection.execute(
                text(
                    'SELECT a.address,d.name,o."districtName" FROM dms.agency a '
                    'JOIN dms.district d ON d.id=a."districtId" '
                    "JOIN dms.agency_overview o ON o.id=a.id ORDER BY a.id"
                )
            ).all()
            assert [row[0] for row in restored] == addresses
            assert [row[1] for row in restored] == ["Quận 1", "Bình Thạnh", "Quận 1", "Quận 1"]
            assert connection.scalar(text("SELECT count(*) FROM dms.district")) == 20
            assert connection.scalar(text("SELECT to_regclass('dms.ward')")) is None
            assert connection.execute(
                text(
                    'SELECT g.code,p."isAllowed" FROM dms.group_permission p '
                    'JOIN dms.app_function f ON f.id=p."functionId" '
                    'JOIN dms.user_group g ON g.id=p."groupId" '
                    "WHERE f.code='district.manage' ORDER BY g.id"
                )
            ).all() == [
                ("MANAGEMENT", True),
                ("SALES", False),
                ("WAREHOUSE", False),
                ("ACCOUNTING", False),
            ]
            assert (
                connection.scalar(text('SELECT "maxAgenciesPerDistrict" FROM dms.business_rule'))
                == 4
            )
        migrate(engine.url)
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM dms.ward")) == 168
            assert connection.execute(
                text("SELECT address FROM dms.agency ORDER BY id")
            ).scalars().all()[:2] == [
                "1 Lê Lợi, Phường Sài Gòn, TP.HCM (mẫu)",
                "2 Phan Đăng Lưu, Phường Bình Thạnh, TP.HCM",
            ]


def test_unmapped_district_fails_upgrade_and_unmapped_ward_blocks_downgrade(database_factory):
    with database_factory("0009") as engine:
        seed_legacy(engine, ["Quận 1", "Bình Thạnh"])
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "SELECT set_config('dms.function_code','district.manage',true)"
            )
            connection.exec_driver_sql(
                "INSERT INTO dms.district (code,name) VALUES ('LEGACY','Quận 2')"
            )
        with pytest.raises(DBAPIError, match="No reviewed ward mapping"):
            migrate(engine.url)
        with engine.connect() as connection:
            assert (
                connection.scalar(text("SELECT version_num FROM public.alembic_version")) == "0009"
            )
            assert connection.scalar(text("SELECT to_regclass('dms.ward')")) is None
        with engine.begin() as connection:
            connection.exec_driver_sql("DELETE FROM dms.district WHERE code='LEGACY'")
        migrate(engine.url)
        with engine.begin() as connection:
            connection.exec_driver_sql(
                'INSERT INTO dms.agency (name,"typeId","wardId",email,"acceptedDate") '
                "SELECT 'Côn Đảo',1,id,'cd@example.com','2026-01-01' FROM dms.ward "
                "WHERE code='26732'"
            )
        with pytest.raises(DBAPIError, match="without a former district"):
            migrate(engine.url, "0009", downgrade=True)
        with engine.connect() as connection:
            assert (
                connection.scalar(text("SELECT version_num FROM public.alembic_version")) == "0010"
            )
