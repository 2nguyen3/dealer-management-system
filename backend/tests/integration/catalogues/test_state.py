from datetime import UTC, datetime, timedelta
from unittest.mock import Mock, patch

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.common.preconditions import parse_preconditions
from app.core.config import Settings
from app.core.exceptions import ApiError
from app.core.security import verify_password
from app.modules.auth.models import AuthToken
from app.modules.auth.service import AuthService
from app.modules.auth.tokens import digest_opaque_token
from app.modules.users.schemas import AdminPasswordReset, UserCreate, UserUpdate
from tests.integration.catalogues.conftest import CASES
from tests.integration.catalogues.helpers import (
    agency,
    count_line,
    draft,
    install_builders,
    post_stock,
    product,
    service_for,
)

pytestmark = pytest.mark.integration


def create_body(use_case, body):
    from app.modules.agency_types.schemas import AgencyTypeCreate
    from app.modules.districts.schemas import DistrictCreate
    from app.modules.units.schemas import UnitCreate

    models = {
        "listDistricts": DistrictCreate,
        "listAgencyTypes": AgencyTypeCreate,
        "listUnits": UnitCreate,
        "listUsers": UserCreate,
    }
    return models[use_case.operation].model_validate(body)


def update_body(resource, values):
    from app.modules.agency_types.schemas import AgencyTypeUpdate
    from app.modules.districts.schemas import DistrictUpdate
    from app.modules.units.schemas import UnitUpdate

    return {
        "districts": DistrictUpdate,
        "agency-types": AgencyTypeUpdate,
        "units": UnitUpdate,
        "users": UserUpdate,
    }[resource].model_validate(values)


def precondition(use_case, identifier):
    return parse_preconditions(use_case.etag(use_case.get(identifier)))


def test_persisted_and_definite_rollback_every_mutation(use_case, resource, engine):
    item = use_case.create(create_body(use_case, CASES[resource][2]))
    identifier = int(item.id)
    change = {"fullName": "Changed"} if resource == "users" else {"name": "Changed"}
    for operation in ("create", "update", "delete" if resource != "users" else "reset"):
        for failure in ("commit", "constraints", "projection"):
            before = use_case.get(identifier).model_dump(mode="json")
            audit = use_case.session.scalar(text("SELECT count(*) FROM dms.audit_log"))
            original = use_case.session.execute

            def fail(sql, *args, original=original, **kwargs):
                if str(sql) == "SET CONSTRAINTS ALL IMMEDIATE":
                    raise RuntimeError("injected constraints failure")
                return original(sql, *args, **kwargs)

            if failure == "commit":
                injector = patch.object(
                    use_case.session, "commit", side_effect=RuntimeError("commit")
                )
            elif failure == "constraints":
                injector = patch.object(use_case.session, "execute", side_effect=fail)
            else:
                # Force a failure at the projection boundary, after persistence has changed.
                if operation in ("delete", "reset"):
                    continue
                original_get = use_case.get
                calls = 0

                def fail_get(id, operation=operation, original_get=original_get):
                    nonlocal calls
                    calls += 1
                    if operation == "create" or calls > 1:
                        raise RuntimeError("projection")
                    return original_get(id)

                injector = patch.object(use_case, "get", side_effect=fail_get)
            with injector, pytest.raises(RuntimeError):
                if operation == "create":
                    body = dict(CASES[resource][2])
                    body.update(
                        {"email": "rollback@example.com"}
                        if resource == "users"
                        else {"code": "ROLLBACK", "name": "Rollback"}
                    )
                    use_case.create(create_body(use_case, body))
                elif operation == "update":
                    use_case.update(
                        identifier,
                        update_body(resource, change),
                        parse_preconditions(use_case.etag(item)),
                    )
                elif operation == "delete":
                    use_case.delete(identifier, parse_preconditions(use_case.etag(item)))
                else:
                    use_case.reset_password(
                        identifier,
                        AdminPasswordReset(newPassword="new"),
                        parse_preconditions(use_case.etag(item)),
                    )
            assert use_case.get(identifier).model_dump(mode="json") == before
            with engine.connect() as connection:
                assert connection.scalar(text("SELECT count(*) FROM dms.audit_log")) == audit
                assert (
                    connection.scalar(
                        text(
                            f"SELECT count(*) FROM dms.{use_case.repo.model.__tablename__} "
                            + (
                                "WHERE email='rollback@example.com'"
                                if resource == "users"
                                else "WHERE code='ROLLBACK'"
                            )
                        )
                    )
                    == 0
                )
                if resource == "users":
                    assert verify_password(
                        "x",
                        connection.scalar(
                            text('SELECT "passwordHash" FROM dms.app_user WHERE id=:id'),
                            {"id": identifier},
                        ),
                    )


def test_repository_is_caller_owned(use_case, resource, engine):
    item = use_case.create(create_body(use_case, CASES[resource][2]))
    identifier = int(item.id)
    column = "fullName" if resource == "users" else "name"
    use_case.repo.update(identifier, {column: "Uncommitted"})
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text(
                    f'SELECT "{column}" FROM dms.{use_case.repo.model.__tablename__} WHERE id=:id'
                ),
                {"id": identifier},
            )
            == "New"
        )
    use_case.session.rollback()
    assert getattr(use_case.get(identifier), column) == "New"


def test_all_sorts_filters_cursor_and_duplicate_boundaries(use_case, resource):
    created = []
    for index in range(3):
        body = dict(CASES[resource][2])
        body.update(
            {"fullName": "PAGE_" + "Same", "email": f"page_{index}@example.com"}
            if resource == "users"
            else {"code": f"PAGE_{index}", "name": f"PAGE_{2 - index}"}
        )
        created.append(use_case.create(create_body(use_case, body)))
    for sort in use_case.sorts:
        page = use_case.list(q=" PAGE_ ", limit=1, sort=sort)
        cursor = page.pagination.nextCursor
        items = list(page.items)
        while page.pagination.hasMore:
            page = use_case.list(q="PAGE_", limit=1, sort=sort, cursor=page.pagination.nextCursor)
            items.extend(page.items)
        assert len(items) == 3 and len({item.id for item in items}) == 3
        field = sort.lstrip("-")
        expected = sorted(
            created,
            key=lambda item: (
                int(item.id) if field == "id" else getattr(item, field),
                int(item.id),
            ),
            reverse=sort.startswith("-"),
        )
        assert [item.id for item in items] == [item.id for item in expected]
        with pytest.raises(ApiError, match="INVALID_CURSOR"):
            use_case.list(q="changed", limit=1, sort=sort, cursor=cursor)
    assert use_case.list(q="%\\").items == []
    assert use_case.list(q="missing").items == []
    if resource == "users":
        assert len(use_case.list(groupId=2, status="ACTIVE").items) == 3
        assert use_case.list(status="LOCKED").items == []
        duplicate = dict(CASES[resource][2], email="PAGE_0@EXAMPLE.COM")
    else:
        assert len(use_case.list(code="PAGE_1", status="ACTIVE").items) == 1
        assert use_case.list(status="INACTIVE").items == []
        duplicate = dict(CASES[resource][2], code="PAGE_0")
        with pytest.raises(ApiError, match="DUPLICATE"):
            use_case.create(
                create_body(use_case, dict(CASES[resource][2], code="OTHER", name="PAGE_2"))
            )
    with pytest.raises(ApiError, match="DUPLICATE"):
        use_case.create(create_body(use_case, duplicate))
    with pytest.raises(ApiError, match="VALIDATION_FAILED"):
        use_case.list(sort="bad")
    # Cursor with a valid signature but absent anchor must also be rejected.
    scope = {"operation": use_case.operation, "boundary": "anchor-v2", "sort": "id", "q": None}
    with pytest.raises(ApiError, match="INVALID_CURSOR"):
        use_case.list(cursor=use_case.codec.encode(scope, [999999, '"missing"']))


def test_long_text_short_cursor_and_removed_anchor(use_case, resource):
    prefix = "LONG_" + "n" * 7000
    for index in range(2):
        body = dict(CASES[resource][2])
        body.update(
            {"fullName": prefix + str(index), "email": f"long{index}@example.com"}
            if resource == "users"
            else {"code": prefix + str(index), "name": prefix + str(index)}
        )
        use_case.create(create_body(use_case, body))
    page = use_case.list(q="LONG_", limit=1, sort="fullName" if resource == "users" else "name")
    assert len(page.pagination.nextCursor) < 384
    assert (
        len(
            use_case.list(
                q="LONG_",
                limit=1,
                sort="fullName" if resource == "users" else "name",
                cursor=page.pagination.nextCursor,
            ).items
        )
        == 1
    )
    if resource != "users":
        use_case.delete(page.items[0].id, parse_preconditions(use_case.etag(page.items[0])))
        with pytest.raises(ApiError, match="INVALID_CURSOR"):
            use_case.list(q="LONG_", limit=1, sort="name", cursor=page.pagination.nextCursor)


@pytest.mark.parametrize("resource", ["users"], indirect=True)
def test_users_group_status_reset_live_effects_and_locked_reset(use_case, client, engine, resource):
    body = dict(CASES["users"][2])
    item = use_case.create(UserCreate.model_validate(body))
    identifier = int(item.id)
    login = client.post("/api/v1/auth/login", json={"email": body["email"], "password": "x"}).json()
    with Session(engine) as session:
        session.add(
            AuthToken(
                user_id=identifier,
                purpose="PASSWORD_RESET",
                token_digest=digest_opaque_token("reset-token"),
                auth_version=1,
                session_id=None,
                expires_at=datetime.now(UTC) + timedelta(days=1),
            )
        )
        session.commit()
    profile = use_case.update(
        identifier,
        UserUpdate(fullName="Profile", email="New@Example.com"),
        precondition(use_case, identifier),
    )
    assert profile.fullName == "Profile"
    with Session(engine) as session:
        settings = Settings(
            _env_file=None,
            db_host="test",
            db_user="test",
            db_password="test",
            auth_signing_key="synthetic-test-key-32-bytes-or-more",
        )
        auth = AuthService(session, settings, Mock())
        assert auth.authenticate(login["accessToken"])
    # Same group/status is a no-op for session identity, even when explicitly patched.
    use_case.update(
        identifier, UserUpdate(groupId=2, status="ACTIVE"), precondition(use_case, identifier)
    )
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text('SELECT "authVersion" FROM dms.app_user WHERE id=:id'), {"id": identifier}
            )
            == 1
        )
    for values in ({"groupId": 3}, {"status": "LOCKED"}, {"status": "ACTIVE"}):
        use_case.update(
            identifier, UserUpdate.model_validate(values), precondition(use_case, identifier)
        )
        with engine.connect() as connection:
            assert (
                connection.scalar(
                    text(
                        "SELECT count(*) FROM dms.auth_token "
                        'WHERE "userId"=:id AND "revokedAt" IS NULL'
                    ),
                    {"id": identifier},
                )
                == 0
            )
        old = client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer " + login["accessToken"]}
        )
        assert old.status_code in (401, 403)
        assert client.post(
            "/api/v1/auth/refresh", json={"refreshToken": login["refreshToken"]}
        ).status_code in (401, 403)
    use_case.update(identifier, UserUpdate(status="LOCKED"), precondition(use_case, identifier))
    use_case.reset_password(
        identifier, AdminPasswordReset(newPassword=" "), precondition(use_case, identifier)
    )
    with engine.connect() as connection:
        row = connection.execute(
            text('SELECT status,"passwordHash" FROM dms.app_user WHERE id=:id'), {"id": identifier}
        ).one()
        assert row[0] == "LOCKED" and verify_password(" ", row[1])
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": "new@example.com", "password": " "}
        ).status_code
        == 403
    )
    with pytest.raises(ApiError, match="NOT_FOUND"):
        use_case.create(UserCreate(**dict(body, groupId=999999, email="missing@example.com")))
    with pytest.raises(ApiError, match="NOT_FOUND"):
        use_case.update(identifier, UserUpdate(groupId=999999), precondition(use_case, identifier))
    with pytest.raises(ApiError, match="NOT_FOUND"):
        use_case.reset_password(
            999999, AdminPasswordReset(newPassword="x"), parse_preconditions('"x"')
        )
    assert use_case.repo.lock(999999) is None
    use_case.session.rollback()


@pytest.mark.parametrize("resource", ["districts", "agency-types"], indirect=True)
def test_master_derived_counts_terminated_references_inactive(use_case, resource, engine, actor):
    item = use_case.create(create_body(use_case, CASES[resource][2]))
    with Session(engine) as session:
        first = agency(
            session,
            district=item.id if resource == "districts" else 1,
            type_id=item.id if resource == "agency-types" else 1,
        )
        second = agency(
            session,
            district=item.id if resource == "districts" else 1,
            type_id=item.id if resource == "agency-types" else 1,
        )
        session.execute(
            text(
                "UPDATE dms.agency SET status='TERMINATED',\"terminatedAt\"=clock_timestamp(),"
                "\"terminationReason\"='Ended' WHERE id=:id"
            ),
            {"id": second},
        )
        session.commit()
    current = use_case.get(item.id)
    assert current.activeAgencyCount == 1
    if resource == "districts":
        assert current.remainingSlots == current.maxAgencies - 1
        before = use_case.etag(current)
        with engine.begin() as connection:
            connection.exec_driver_sql('UPDATE dms.business_rule SET "maxAgenciesPerDistrict"=5')
        assert (
            use_case.get(item.id).maxAgencies == 5
            and use_case.etag(use_case.get(item.id)) != before
        )
    else:
        assert current.agencyCount == 2
    inactive = use_case.update(
        item.id, update_body(resource, {"status": "INACTIVE"}), precondition(use_case, item.id)
    )
    assert inactive.activeAgencyCount == 1
    with pytest.raises(ApiError, match="RESOURCE_IN_USE"):
        use_case.delete(item.id, precondition(use_case, item.id))
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT count(*) FROM dms.agency WHERE id IN (:a,:b)"),
                {"a": first, "b": second},
            )
            == 2
        )
    with Session(engine) as session:
        with pytest.raises(DBAPIError):
            agency(
                session,
                district=item.id if resource == "districts" else 1,
                type_id=item.id if resource == "agency-types" else 1,
            )
        session.rollback()


@pytest.mark.parametrize("resource", ["units"], indirect=True)
@pytest.mark.parametrize("reference", ["product", "draft", "posted", "cancelled", "count"])
def test_unit_all_recorded_reference_and_fraction_guards(
    use_case, engine, actor, reference, resource
):
    item = use_case.create(create_body(use_case, dict(CASES[resource][2], allowsFraction=True)))
    item = use_case.update(
        item.id, update_body(resource, {"allowsFraction": False}), precondition(use_case, item.id)
    )
    with Session(engine) as session:
        install_builders(session, actor)
        product_id = product(session, item.id)
        if reference == "count":
            count_line(session, actor, product_id, item.id)
        elif reference != "product":
            document_id = draft(session, product_id)
            if reference == "posted":
                post_stock(session, document_id)
            elif reference == "cancelled":
                session.execute(
                    text(
                        "UPDATE dms.document SET status='CANCELLED',"
                        '"cancelledAt"=clock_timestamp(),'
                        '"cancelledBy"=:actor,"cancelReason"=\'Duplicate\' WHERE id=:id'
                    ),
                    {"actor": actor, "id": document_id},
                )
        session.commit()
    assert use_case.get(item.id).productCount == 1
    if reference == "product":
        assert use_case.update(
            item.id,
            update_body(resource, {"allowsFraction": True}),
            precondition(use_case, item.id),
        ).allowsFraction
    else:
        with pytest.raises(ApiError, match="MASTER_CONFLICT"):
            use_case.update(
                item.id,
                update_body(resource, {"allowsFraction": True}),
                precondition(use_case, item.id),
            )
        assert not use_case.update(
            item.id,
            update_body(resource, {"allowsFraction": False}),
            precondition(use_case, item.id),
        ).allowsFraction
    with pytest.raises(ApiError, match="RESOURCE_IN_USE"):
        use_case.delete(item.id, precondition(use_case, item.id))
    assert (
        use_case.update(
            item.id, update_body(resource, {"status": "INACTIVE"}), precondition(use_case, item.id)
        ).status
        == "INACTIVE"
    )
    # Explicit policy covers recorded refs even without relying on current productCount.
    assert use_case.repo.recorded(item.id) == (reference != "product")
    assert not use_case.repo.references(999999)


@pytest.mark.parametrize("resource", ["units"], indirect=True)
def test_inactive_and_integer_fraction_receipt_rejection(use_case, engine, actor, resource):
    item = use_case.create(create_body(use_case, CASES[resource][2]))
    with Session(engine) as session:
        install_builders(session, actor)
        product_id = product(session, item.id)
        session.commit()
        with pytest.raises(DBAPIError):
            draft(session, product_id, quantity="0.5")
        session.rollback()
        install_builders(session, actor)
        document_id = draft(session, product_id)
        session.commit()
    use_case.update(
        item.id, update_body(resource, {"status": "INACTIVE"}), precondition(use_case, item.id)
    )
    with Session(engine) as session:
        install_builders(session, actor)
        with pytest.raises(DBAPIError):
            post_stock(session, document_id)
        session.rollback()
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text('SELECT "currentStock" FROM dms.inventory_balance WHERE "productId"=:id'),
                {"id": product_id},
            )
            == 0
        )


@pytest.mark.parametrize("reference", ["draft", "count"])
def test_unit_historical_only_reference_still_blocks_delete(engine, actor, reference):
    from tests.support.database import migrate

    # This is a populated legacy fixture: 0005 allowed non-posted product moves.
    # 0006 must preserve its historical unit references while preventing new moves.
    migrate(engine.url, "0005", downgrade=True)
    with Session(engine) as session:
        service = service_for("units", session, actor)
        old = service.create(create_body(service, {"code": "OLD", "name": "Old"}))
        new = service.create(create_body(service, {"code": "NEW", "name": "New"}))
        install_builders(session, actor)
        product_id = product(session, old.id)
        if reference == "draft":
            draft(session, product_id)
        else:
            count_line(session, actor, product_id, old.id)
        session.execute(
            text('UPDATE dms.product SET "unitId"=:unit WHERE id=:id'),
            {"unit": new.id, "id": product_id},
        )
        session.commit()
    migrate(engine.url)
    with Session(engine) as session:
        service = service_for("units", session, actor)
        assert service.get(old.id).productCount == 0
        assert service.repo.references(old.id)
        with pytest.raises(ApiError, match="RESOURCE_IN_USE"):
            service.delete(old.id, precondition(service, old.id))


def test_full_district_capacity_is_global_and_fifth_admission_rolls_back(engine, actor):
    with Session(engine) as session:
        service = service_for("districts", session, actor)
        district = service.create(create_body(service, {"code": "FULL", "name": "Full"}))
        assert district.remainingSlots == district.maxAgencies == 4
        for _ in range(4):
            agency(session, district=district.id)
        session.commit()
        full = service.get(district.id)
        assert full.activeAgencyCount == 4 and full.remainingSlots == 0
        with pytest.raises(DBAPIError) as error:
            agency(session, district=district.id)
        assert error.value.orig.sqlstate == "23514"
        session.rollback()
        assert service.get(district.id).activeAgencyCount == 4
