from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from threading import Barrier, Event
from unittest.mock import Mock, patch

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import parse_preconditions
from app.core.config import Settings
from app.core.exceptions import ApiError, AuthError
from app.modules.auth.service import AuthService
from app.modules.user_groups.schemas import GroupCreate
from app.modules.user_groups.service import GroupService, group_etag
from app.modules.users.schemas import AdminPasswordReset, UserCreate, UserUpdate
from tests.integration.catalogues.helpers import (
    agency,
    count_line,
    draft,
    install_builders,
    post_stock,
    product,
    service_for,
)
from tests.integration.catalogues.test_state import create_body, update_body
from tests.integration.user_groups.test_group_concurrency import wait_for_blocker
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


def ordered_race(engine, leading, following):
    """Hold the first real transaction before commit and observe the second's PG wait."""
    acquired, release = Event(), Event()
    waiter = Queue()

    def run(work, first):
        with Session(engine) as session:
            original = session.commit

            def commit():
                if first:
                    acquired.set()
                    assert release.wait(race_timeout(10))
                original()

            if not first:
                waiter.put(session.scalar(text("SELECT pg_backend_pid()")))
            try:
                with patch.object(session, "commit", side_effect=commit):
                    return work(session)
            except (ApiError, AuthError) as error:
                return error.code
            except DBAPIError as error:
                session.rollback()
                return error.orig.sqlstate

    with ThreadPoolExecutor(2) as pool:
        lead = pool.submit(run, leading, True)
        if not acquired.wait(race_timeout(10)):
            release.set()
            pytest.fail(
                f"Leading transaction never reached commit: {lead.result(timeout=race_timeout(5))}"
            )
        follow = pool.submit(run, following, False)
        try:
            wait_for_blocker(engine, waiter.get(timeout=race_timeout(10)))
        finally:
            release.set()
        return lead.result(timeout=race_timeout(20)), follow.result(timeout=race_timeout(20))


def test_competing_etag_writers_one_winner(use_case, resource, engine, actor):
    body = (
        {"fullName": "New", "email": "new@example.com", "password": "x", "groupId": 2}
        if resource == "users"
        else {
            "code": "NEW",
            "name": "New",
            **({"maxDebt": "0"} if resource == "agency-types" else {}),
        }
    )
    item = use_case.create(create_body(use_case, body))
    match = use_case.etag(item)
    barrier = Barrier(2)

    def write(name):
        with Session(engine) as session:
            service = service_for(resource, session, actor)
            barrier.wait(timeout=race_timeout(10))
            try:
                return service.update(
                    int(item.id),
                    update_body(resource, {"fullName" if resource == "users" else "name": name}),
                    parse_preconditions(match),
                )
            except ApiError as error:
                return error.code

    with ThreadPoolExecutor(2) as pool:
        outcomes = [
            future.result(timeout=race_timeout(20))
            for future in [pool.submit(write, name) for name in ("One", "Two")]
        ]
    assert sum(item == "PRECONDITION_FAILED" for item in outcomes) == 1
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT count(*) FROM dms.audit_log WHERE \"requestId\"='race-request'")
            )
            == 1
        )


def test_case_insensitive_email_creation_race(engine, actor):
    def create(session, email):
        return service_for("users", session, actor).create(
            UserCreate(fullName="User", email=email, password="x", groupId=2)
        )

    first, second = ordered_race(
        engine, lambda s: create(s, "Race@Example.com"), lambda s: create(s, "race@example.com")
    )
    assert first.email == "Race@Example.com" and second == "DUPLICATE"
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT count(*) FROM dms.app_user WHERE lower(email)='race@example.com'")
            )
            == 1
        )


@pytest.mark.parametrize("assignment", ["create", "update"])
@pytest.mark.parametrize("first", ["assign", "delete"])
def test_real_m04_assignment_vs_m03_deletion(engine, actor, first, assignment):
    with Session(engine) as session:
        groups = GroupService(
            session, CursorCodec(b"x" * 32), actor, "group-create", lambda _: None
        )
        group = groups.create(GroupCreate(code="TEAM", name="Team"))
        if assignment == "update":
            users = service_for("users", session, actor)
            user = users.create(
                UserCreate(fullName="Member", email="member@example.com", password="x", groupId=2)
            )
            token = users.etag(user)

    def assign(session):
        users = service_for("users", session, actor)
        if assignment == "create":
            return users.create(
                UserCreate(
                    fullName="Member", email="member@example.com", password="x", groupId=group.id
                )
            )
        return users.update(int(user.id), UserUpdate(groupId=group.id), parse_preconditions(token))

    def delete(session):
        groups = GroupService(
            session, CursorCodec(b"x" * 32), actor, "race-request", lambda _: None
        )
        groups.delete(group.id, parse_preconditions(group_etag(group)))
        return "deleted"

    outcomes = ordered_race(
        engine, assign if first == "assign" else delete, delete if first == "assign" else assign
    )
    if first == "assign":
        assert outcomes[0].groupId == group.id and outcomes[1] == "PRECONDITION_FAILED"
    else:
        assert outcomes == ("deleted", "NOT_FOUND")


@pytest.mark.parametrize("change", ["group", "status", "reset"])
@pytest.mark.parametrize("action", ["login", "refresh"])
@pytest.mark.parametrize("first", ["auth", "admin"])
def test_real_administration_vs_auth_both_winners(engine, actor, change, action, first):
    settings = Settings(
        _env_file=None,
        db_host="test",
        db_user="test",
        db_password="test",
        auth_signing_key="synthetic-test-key-32-bytes-or-more",
    )
    with Session(engine) as session:
        users = service_for("users", session, actor)
        user = users.create(
            UserCreate(fullName="Member", email="member@example.com", password="x", groupId=2)
        )
        match = users.etag(user)
        original = AuthService(session, settings, Mock()).login("member@example.com", "x")

    def auth(session):
        service = AuthService(session, settings, Mock())
        return (
            service.login("member@example.com", "x")
            if action == "login"
            else service.refresh_tokens(original.refreshToken)
        )

    def admin(session):
        users = service_for("users", session, actor)
        if change == "reset":
            users.reset_password(
                int(user.id), AdminPasswordReset(newPassword="new"), parse_preconditions(match)
            )
        else:
            users.update(
                int(user.id),
                UserUpdate.model_validate(
                    {"groupId": 3} if change == "group" else {"status": "LOCKED"}
                ),
                parse_preconditions(match),
            )
        return "admin"

    leading, following = ordered_race(
        engine, auth if first == "auth" else admin, admin if first == "auth" else auth
    )
    if first == "auth":
        assert following == "admin"
        issued = leading
    else:
        assert leading == "admin" and following in (
            "INVALID_CREDENTIALS",
            "INVALID_OR_EXPIRED_TOKEN",
            "ACCOUNT_LOCKED",
        )
        issued = original
    with Session(engine) as session:
        service = AuthService(session, settings, Mock())
        with pytest.raises(AuthError):
            service.authenticate(issued.accessToken)
        assert (
            session.scalar(
                text(
                    'SELECT count(*) FROM dms.auth_token WHERE "userId"=:id AND "revokedAt" IS NULL'
                ),
                {"id": int(user.id)},
            )
            == 0
        )
        assert (
            session.scalar(
                text('SELECT "authVersion" FROM dms.app_user WHERE id=:id'), {"id": int(user.id)}
            )
            == 2
        )


@pytest.mark.parametrize("resource", ["districts", "agency-types", "units"], indirect=True)
@pytest.mark.parametrize("first", ["assign", "delete"])
def test_catalogue_reference_creation_vs_delete(use_case, resource, engine, actor, first):
    body = {
        "code": "TARGET",
        "name": "Target",
        **({"maxDebt": "1000"} if resource == "agency-types" else {}),
    }
    item = use_case.create(create_body(use_case, body))
    # Set up the other master before the race, avoiding fixture locks during admission.
    if resource == "agency-types":
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "INSERT INTO dms.district (code,name) VALUES ('BASE','Base')"
            )

    def assign(session):
        if resource == "units":
            product(session, item.id)
        else:
            agency(
                session,
                district=item.id if resource == "districts" else 1,
                type_id=item.id if resource == "agency-types" else 1,
            )
        session.commit()
        return "assigned"

    def remove(session):
        service_for(resource, session, actor).delete(
            item.id, parse_preconditions(use_case.etag(item))
        )
        return "deleted"

    outcomes = ordered_race(
        engine, assign if first == "assign" else remove, remove if first == "assign" else assign
    )
    if first == "assign":
        assert outcomes == ("assigned", "PRECONDITION_FAILED")
    else:
        assert outcomes[0] == "deleted" and outcomes[1] in ("23503", "23514", "P0002")


@pytest.mark.parametrize("first", ["assign", "inactive"])
def test_district_admission_vs_inactivation(engine, actor, first):
    with Session(engine) as session:
        service = service_for("districts", session, actor)
        item = service.create(create_body(service, {"code": "TARGET", "name": "Target"}))
        match = service.etag(item)

    def assign(session):
        agency(session, district=item.id)
        session.commit()
        return "assigned"

    def inactive(session):
        service = service_for("districts", session, actor)
        return service.update(
            item.id, update_body("districts", {"status": "INACTIVE"}), parse_preconditions(match)
        )

    outcomes = ordered_race(
        engine, assign if first == "assign" else inactive, inactive if first == "assign" else assign
    )
    if first == "assign":
        assert outcomes == ("assigned", "PRECONDITION_FAILED")
    else:
        assert outcomes[0].status == "INACTIVE" and outcomes[1] == "23514"


@pytest.mark.parametrize("reference", ["draft", "count", "posting"])
@pytest.mark.parametrize("first", ["use", "policy"])
def test_unit_first_recording_or_post_vs_fraction_policy(engine, actor, reference, first):
    with Session(engine) as session:
        service = service_for("units", session, actor)
        item = service.create(
            create_body(service, {"code": "TARGET", "name": "Target", "allowsFraction": True})
        )
        install_builders(session, actor)
        product_id = product(session, item.id)
        if reference == "posting":
            document_id = draft(session, product_id, quantity="1.5")
        session.commit()
        current = service.get(item.id)
        match = service.etag(current)
    if reference == "posting":
        # A draft already freezes source meaning. Race posting against inactivation.
        change = {"status": "INACTIVE"}
    else:
        change = {"allowsFraction": False}

    def use(session):
        install_builders(session, actor)
        if reference == "count":
            count_line(session, actor, product_id, item.id, counted="1.5")
        elif reference == "draft":
            draft(session, product_id, quantity="1.5")
        else:
            post_stock(session, document_id)
        session.commit()
        return "used"

    def policy(session):
        return service_for("units", session, actor).update(
            item.id, update_body("units", change), parse_preconditions(match)
        )

    leading, following = ordered_race(
        engine, use if first == "use" else policy, policy if first == "use" else use
    )
    if first == "use":
        assert leading == "used"
        if reference == "posting":
            assert following.status == "INACTIVE"
        else:
            assert following == "MASTER_CONFLICT"
    else:
        assert following == "23514"


@pytest.mark.parametrize("first", ["issue", "limit"])
def test_issue_posting_vs_type_limit_lowering(engine, actor, first):
    with Session(engine) as session:
        service = service_for("agency-types", session, actor)
        item = service.create(
            create_body(service, {"code": "TARGET", "name": "Target", "maxDebt": "1000"})
        )
        install_builders(session, actor)
        session.execute(text("INSERT INTO dms.unit (code,name) VALUES ('PIECE','Piece')"))
        product_id = product(session)
        agency_id = agency(session, type_id=item.id)
        receipt = draft(session, product_id, quantity="10")
        post_stock(session, receipt)
        issue = draft(session, product_id, kind="STOCK_ISSUE", agency_id=agency_id)
        session.execute(text("SELECT pg_temp.ready(:id)"), {"id": issue})
        session.commit()
        match = service.etag(service.get(item.id))

    def issue_post(session):
        install_builders(session, actor)
        post_stock(session, issue)
        session.commit()
        return "posted"

    def lower(session):
        return service_for("agency-types", session, actor).update(
            item.id, update_body("agency-types", {"maxDebt": "0"}), parse_preconditions(match)
        )

    leading, following = ordered_race(
        engine, issue_post if first == "issue" else lower, lower if first == "issue" else issue_post
    )
    if first == "issue":
        assert leading == "posted" and following == "DEBT_LIMIT_BELOW_CURRENT_BALANCE"
    else:
        assert leading.maxDebt == 0 and following == "23514"


@pytest.mark.parametrize("first", ["assign", "limit"])
def test_type_assignment_vs_limit_change(engine, actor, first):
    with Session(engine) as session:
        service = service_for("agency-types", session, actor)
        item = service.create(
            create_body(service, {"code": "TARGET", "name": "Target", "maxDebt": "1000"})
        )
        agency_id = agency(session)
        session.commit()
        match = service.etag(service.get(item.id))

    def assign(session):
        session.execute(
            text('UPDATE dms.agency SET "typeId"=:type WHERE id=:id'),
            {"type": item.id, "id": agency_id},
        )
        session.commit()
        return "assigned"

    def lower(session):
        return service_for("agency-types", session, actor).update(
            item.id, update_body("agency-types", {"maxDebt": "0"}), parse_preconditions(match)
        )

    leading, following = ordered_race(
        engine, assign if first == "assign" else lower, lower if first == "assign" else assign
    )
    if first == "assign":
        assert leading == "assigned" and following == "PRECONDITION_FAILED"
    else:
        assert leading.maxDebt == 0 and following == "assigned"
