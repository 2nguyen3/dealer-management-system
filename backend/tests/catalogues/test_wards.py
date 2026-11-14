"""Offline contract tests for the read-only HCMC ward catalogue (revision 0010)."""

from datetime import UTC, datetime
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.common.schemas import Pagination
from app.core.config import Settings
from app.core.exceptions import ApiError
from app.main import create_app
from app.modules.auth.dependencies import get_auth_service
from app.modules.auth.permissions import (
    FUNCTION_CODES,
    RETIRED_FUNCTION_CODES,
    AuditFunctionCode,
)
from app.modules.wards.dependencies import get_ward_service
from app.modules.wards.repository import WardRepository
from app.modules.wards.schemas import WardListResponse, WardResponse
from app.modules.wards.service import WardService
from tests.support.contract import SOURCE, assert_schema

NOW = datetime(2026, 11, 13, 3, tzinfo=UTC)
ITEM = {
    "id": 68,
    "code": "26740",
    "name": "Phường Sài Gòn",
    "kind": "WARD",
    "activeAgencyCount": 1,
    "maxAgencies": 4,
    "remainingSlots": 3,
    "createdAt": NOW,
    "updatedAt": NOW,
}


def test_ward_response_kind_code_and_no_status():
    item = WardResponse.model_validate(ITEM)
    assert item.kind == "WARD" and item.code == "26740"
    assert_schema(item.model_dump(mode="json"), "WardResponse")
    for kind in ("COMMUNE", "SPECIAL_ZONE"):
        assert WardResponse.model_validate({**ITEM, "kind": kind}).kind == kind
    for bad in (
        {"kind": "DISTRICT"},
        {"kind": "ward"},
        {"code": "2674"},
        {"code": "267400"},
        {"code": "Q01"},
        {"status": "ACTIVE"},
        {"remainingSlots": -1},
        {"maxAgencies": 0},
        {"id": 0},
    ):
        with pytest.raises(ValidationError):
            WardResponse.model_validate({**ITEM, **bad})


def test_ward_repository_projection_and_service_policy():
    assert set(WardRepository.columns) == {"id", "code", "name", "kind", "createdAt", "updatedAt"}
    sql = str(WardRepository(Mock()).query())
    assert '"wardId"' in sql and '"maxAgenciesPerWard"' in sql and "status" in sql
    assert WardService.operation == "listWards" and WardService.permission in FUNCTION_CODES
    # Read-only: no repository mutation hooks are defined for wards.
    assert "references" not in WardRepository.__dict__
    assert "validate_update" not in WardRepository.__dict__


def test_retired_district_function_code_is_audit_only():
    # 0011 rebuilds the audit log, so no retired code survives the simplification.
    assert "district.manage" not in FUNCTION_CODES
    assert RETIRED_FUNCTION_CODES == frozenset()
    assert set(AuditFunctionCode.__args__) == FUNCTION_CODES | RETIRED_FUNCTION_CODES
    source = SOURCE["components"]["schemas"]
    assert set(source["FunctionCode"]["enum"]) == FUNCTION_CODES
    assert set(source["AuditFunctionCode"]["enum"]) == FUNCTION_CODES | RETIRED_FUNCTION_CODES


@pytest.fixture
def harness():
    app = create_app(
        Settings(
            _env_file=None,
            db_host="localhost",
            db_user="test",
            db_password="test",
            auth_signing_key="synthetic-test-key-32-bytes-or-more",
        )
    )
    auth = Mock()
    auth.authenticate.return_value = Mock(user_id=7)
    auth.get_current_user.return_value = Mock(allowedFunctions=["agency.read"])
    service = Mock()
    service.list.return_value = WardListResponse(
        items=[WardResponse.model_validate(ITEM)],
        pagination=Pagination(limit=25, hasMore=False, nextCursor=None),
    )
    service.get.return_value = WardResponse.model_validate(ITEM)
    service.etag.return_value = '"ward-etag"'
    app.dependency_overrides[get_auth_service] = lambda: auth
    app.dependency_overrides[get_ward_service] = lambda: service
    with TestClient(app, raise_server_exceptions=False) as client:
        client.headers["Authorization"] = "Bearer synthetic"
        yield client, auth, service


def test_list_filters_defaults_and_validation(harness):
    client, _, service = harness
    response = client.get("/api/v1/wards")
    assert response.status_code == 200
    assert_schema(response.json(), "WardListResponse")
    service.list.assert_called_with(limit=25, cursor=None, q=None, code=None, kind=None, sort="id")
    response = client.get(
        "/api/v1/wards",
        params={"limit": 100, "q": "Sài", "code": "26740", "kind": "COMMUNE", "sort": "-name"},
    )
    assert response.status_code == 200
    service.list.assert_called_with(
        limit=100, cursor=None, q="Sài", code="26740", kind="COMMUNE", sort="-name"
    )
    for params in (
        {"kind": "DISTRICT"},
        {"limit": 0},
        {"limit": 101},
        {"sort": "kind"},
        {"q": ""},
        {"status": "ACTIVE", "unknown": "x"},
    ):
        if "unknown" in params:
            # Unknown query parameters are ignored like other catalogue reads.
            assert client.get("/api/v1/wards", params=params).status_code == 200
        else:
            assert client.get("/api/v1/wards", params=params).status_code == 422


def test_detail_etag_not_found_and_read_only_methods(harness):
    client, _, service = harness
    detail = client.get("/api/v1/wards/68")
    assert detail.status_code == 200 and detail.headers["ETag"] == '"ward-etag"'
    assert detail.json()["name"] == "Phường Sài Gòn"
    service.get.assert_called_with(68)
    for bad in ("0", "abc", "2147483648", "01"):
        assert client.get("/api/v1/wards/" + bad).status_code == 422
    service.get.side_effect = ApiError(404, "NOT_FOUND", "Resource not found")
    missing = client.get("/api/v1/wards/169")
    assert missing.status_code == 404 and missing.json()["code"] == "NOT_FOUND"
    assert client.post("/api/v1/wards", json={"code": "1", "name": "x"}).status_code == 405
    for method in ("patch", "delete", "put"):
        assert client.request(method, "/api/v1/wards/68", json={}).status_code == 405
    assert client.get("/api/v1/districts").status_code == 404


@pytest.mark.parametrize(
    "allowed,status",
    [(["agency.read"], 200), (["agency.manage"], 200), (["rules.manage"], 403), ([], 403)],
)
def test_read_permission_any_of_agency_read_or_manage(harness, allowed, status):
    client, auth, _ = harness
    auth.get_current_user.return_value = Mock(allowedFunctions=allowed)
    assert client.get("/api/v1/wards").status_code == status
    assert client.get("/api/v1/wards/68").status_code == status
    assert client.get("/api/v1/wards", headers={"Authorization": ""}).status_code == 401


def test_runtime_openapi_matches_source_ward_contract(harness):
    client, _, _ = harness
    runtime = client.get("/api/openapi.json").json()
    assert set(runtime["paths"]["/api/v1/wards"]) == {"get"}
    assert set(runtime["paths"]["/api/v1/wards/{wardId}"]) == {"get"}
    assert not any("district" in path for path in runtime["paths"])
    for path, operation_id in (("/wards", "listWards"), ("/wards/{wardId}", "getWard")):
        actual = runtime["paths"]["/api/v1" + path]["get"]
        expected = SOURCE["paths"][path]["get"]
        assert actual["operationId"] == expected["operationId"] == operation_id
        assert actual["x-permissions"] == expected["x-permissions"]
        assert set(actual["responses"]) == set(expected["responses"])
    names = {p["name"] for p in runtime["paths"]["/api/v1/wards"]["get"]["parameters"]}
    assert names == {"limit", "cursor", "q", "code", "kind", "sort"}
    for path in ("/agencies", "/reports/debt"):
        names = {p["name"] for p in runtime["paths"]["/api/v1" + path]["get"]["parameters"]}
        assert "wardId" in names and "districtId" not in names
