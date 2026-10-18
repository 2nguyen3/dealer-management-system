from typing import Annotated
from uuid import UUID, uuid4

import pytest
from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.commands import CommandResult, CommandScope
from app.common.preconditions import canonical_etag, read_preconditions
from app.common.transport import BusinessRoute
from app.core.config import Settings
from app.core.exceptions import AuthError
from app.core.request_context import set_audit_context
from app.core.security import hash_password
from app.core.transactions import TransactionRunner
from app.db.session import get_session
from app.main import create_app
from app.modules.auth.dependencies import get_auth_service, require_permissions
from app.modules.auth.service import AuthService, Principal
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_real_http_commands_current_grants_and_aggregate_etag(engine, actor):
    settings = Settings(
        _env_file=None,
        db_host="localhost",
        db_user="test",
        db_password="test",
        auth_signing_key="synthetic-test-key-32-bytes-or-more",
    )
    with engine.begin() as connection:
        connection.execute(
            text('UPDATE dms.app_user SET "passwordHash"=:hash WHERE id=:id'),
            {"hash": hash_password("test-password"), "id": actor},
        )
    app = create_app(settings)
    router = APIRouter(route_class=BusinessRoute)
    permission = require_permissions(all_of=("district.manage",))

    def sessions():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = sessions

    @router.post("/probe-command", operation_id="probeUpdate")
    def update(
        request: Request,
        principal: Annotated[Principal, Depends(permission)],
        session: Annotated[Session, Depends(get_session)],
        service: Annotated[AuthService, Depends(get_auth_service)],
        key: Annotated[UUID, Header(alias="Idempotency-Key")],
        match: Annotated[str | None, Header(alias="If-Match")] = None,
    ):
        def authorize():
            service.repo.lock_user(principal.user_id)
            current = service.get_current_user(principal)
            if "district.manage" not in current.allowedFunctions:
                raise AuthError(403, "FORBIDDEN", "Permission denied")

        def project():
            value = session.scalar(text("SELECT value FROM dms.probe WHERE id=1"))
            return CommandResult(
                status=200,
                body={"value": value},
                headers={"ETag": canonical_etag("probe:1", {"value": value})},
            )

        def work(command):
            value = session.scalar(text("SELECT value FROM dms.probe WHERE id=1 FOR UPDATE"))
            read_preconditions(request).compare(canonical_etag("probe:1", {"value": value}))
            set_audit_context(
                session,
                principal.user_id,
                request.state.request_id,
                function_code="district.manage",
            )
            session.execute(
                text("INSERT INTO dms.district (code,name) VALUES ('HTTP_COMMAND','HTTP command')")
            )
            session.execute(text("UPDATE dms.probe SET value=value+1 WHERE id=1"))
            return project

        result = TransactionRunner(session).run(
            CommandScope(principal.user_id, "probeUpdate", "probe:1", key),
            {},
            authorize=authorize,
            work=work,
        )
        return JSONResponse(result.body, status_code=result.status, headers=result.headers)

    app.include_router(router, prefix="/api/v1")
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            login = client.post(
                "/api/v1/auth/login",
                json={"email": "test@example.com", "password": "test-password"},
            )
            assert login.status_code == 200
            headers = {
                "Authorization": "Bearer " + login.json()["accessToken"],
                "Idempotency-Key": str(uuid4()),
            }
            missing = client.post("/api/v1/probe-command", headers=headers)
            assert missing.status_code == 428
            assert_schema(missing.json(), "Error")
            first = client.post(
                "/api/v1/probe-command",
                headers=headers | {"If-Match": canonical_etag("probe:1", {"value": 0})},
            )
            assert first.status_code == 200 and first.json() == {"value": 1}
            replay = client.post("/api/v1/probe-command", headers=headers | {"If-Match": '"old"'})
            assert replay.status_code == 200 and replay.json() == first.json()
            assert replay.headers["ETag"] == first.headers["ETag"]
            fresh = client.post(
                "/api/v1/probe-command",
                headers=headers | {"Idempotency-Key": str(uuid4()), "If-Match": '"old"'},
            )
            assert fresh.status_code == 412
            with engine.begin() as connection:
                connection.exec_driver_sql(
                    'UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1 '
                    'AND "functionId"=(SELECT id FROM dms.app_function '
                    "WHERE code='district.manage')"
                )
            denied = client.post("/api/v1/probe-command", headers=headers)
            assert denied.status_code == 403
            with engine.connect() as connection:
                assert connection.scalar(text("SELECT count(*) FROM dms.api_idempotency")) == 1
                assert (
                    connection.scalar(
                        text("SELECT count(*) FROM dms.district WHERE code='HTTP_COMMAND'")
                    )
                    == 1
                )
                assert (
                    connection.scalar(
                        text('SELECT count(*) FROM dms.audit_log WHERE "requestId"=:id'),
                        {"id": first.headers["X-Request-Id"]},
                    )
                    == 1
                )
    finally:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                'UPDATE dms.group_permission SET "isAllowed"=true WHERE "groupId"=1 '
                'AND "functionId"=(SELECT id FROM dms.app_function '
                "WHERE code='district.manage')"
            )
