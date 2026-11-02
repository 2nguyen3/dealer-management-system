import json
from pathlib import Path
from typing import Annotated

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator, FormatChecker
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.main import create_app
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.models import AuthToken

pytestmark = pytest.mark.integration
SOURCE = json.loads(
    (Path(__file__).parents[4] / "openwiki/backend-design/API/openapi.json").read_text(
        encoding="utf-8"
    )
)


def check_schema(response, name):
    Draft202012Validator(SOURCE, format_checker=FormatChecker()).evolve(
        schema={"$ref": f"#/components/schemas/{name}"}
    ).validate(response.json())


@pytest.fixture
def client(engine, settings, delivery):
    app = create_app(settings)
    app.state.reset_delivery = delivery

    def session_override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = session_override

    @app.get("/api/v1/auth/test-protected")
    def protected(
        principal: Annotated[object, Depends(require_permissions(all_of=("users.manage",)))],
    ):
        return {"id": principal.user_id}

    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


def test_complete_http_lifecycle(client, user, delivery, engine):
    invalid = client.post(
        "/api/v1/auth/login", json={"email": "employee@example.com", "password": "wrong"}
    )
    assert invalid.status_code == 401
    check_schema(invalid, "Error")
    login = client.post(
        "/api/v1/auth/login", json={"email": "EMPLOYEE@example.com", "password": "old password"}
    )
    assert login.status_code == 200
    check_schema(login, "TokenResponse")
    assert login.headers["Cache-Control"] == "no-store"
    tokens = login.json()
    assert set(tokens["user"]) == {
        "id",
        "fullName",
        "email",
        "groupId",
        "groupCode",
        "groupName",
        "status",
        "createdAt",
        "updatedAt",
    }
    headers = {"Authorization": "Bearer " + tokens["accessToken"]}
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    check_schema(me, "CurrentUser")
    assert client.get("/api/v1/auth/test-protected", headers=headers).status_code == 200
    with engine.begin() as connection:
        connection.execute(
            text(
                'UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1 '
                "AND \"functionId\"=(SELECT id FROM dms.app_function WHERE code='users.manage')"
            )
        )
    assert (
        "users.manage"
        not in client.get("/api/v1/auth/me", headers=headers).json()["allowedFunctions"]
    )
    assert client.get("/api/v1/auth/test-protected", headers=headers).status_code == 403
    refresh = client.post("/api/v1/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert refresh.status_code == 200
    check_schema(refresh, "TokenResponse")
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    change = client.put(
        "/api/v1/auth/password",
        headers=headers,
        json={"currentPassword": "old password", "newPassword": "new"},
    )
    assert change.status_code == 204 and change.content == b""
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    request = client.post(
        "/api/v1/auth/password-reset-requests", json={"email": "employee@example.com"}
    )
    assert request.status_code == 202
    check_schema(request, "AcceptedMessage")
    reset_token = delivery.messages[-1][1]
    reset = client.post(
        "/api/v1/auth/password-resets", json={"token": reset_token, "newPassword": "final"}
    )
    assert reset.status_code == 204 and reset.content == b""
    assert (
        client.post(
            "/api/v1/auth/password-resets", json={"token": reset_token, "newPassword": "final"}
        ).status_code
        == 401
    )
    final = client.post(
        "/api/v1/auth/login", json={"email": "employee@example.com", "password": "final"}
    ).json()
    logout = client.post("/api/v1/auth/logout", json={"refreshToken": final["refreshToken"]})
    assert logout.status_code == 204 and logout.content == b""
    assert client.post("/api/v1/auth/logout", json={"refreshToken": "unknown"}).status_code == 204
    with Session(engine) as session:
        assert all(t.revoked_at is not None for t in session.scalars(select(AuthToken)))


def test_reset_privacy_disabled_and_failure(client, user, delivery, engine):
    outcomes = []
    for email in ("employee@example.com", "missing@example.com"):
        response = client.post("/api/v1/auth/password-reset-requests", json={"email": email})
        assert response.status_code == 202
        outcomes.append(response.json()["message"])
    delivery.failure = True
    response = client.post(
        "/api/v1/auth/password-reset-requests", json={"email": "employee@example.com"}
    )
    assert response.status_code == 202
    outcomes.append(response.json()["message"])
    delivery.failure = False
    with engine.begin() as connection:
        connection.execute(
            text("UPDATE dms.app_user SET status='LOCKED' WHERE id=:id"), {"id": user}
        )
    response = client.post(
        "/api/v1/auth/password-reset-requests", json={"email": "employee@example.com"}
    )
    outcomes.append(response.json()["message"])
    assert len(set(outcomes)) == 1 and len(delivery.messages) == 1
    delivery.enabled = False
    for email in ("employee@example.com", "missing@example.com"):
        response = client.post("/api/v1/auth/password-reset-requests", json={"email": email})
        assert response.status_code == 503 and int(response.headers["Retry-After"]) > 0
        check_schema(response, "Error")
