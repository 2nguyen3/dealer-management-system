from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import Mock

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.exceptions import ApiError, AuthError
from app.modules.auth.permissions import FUNCTION_CODES
from app.modules.dashboard import service as dashboard
from app.modules.dashboard.repository import DRAFT_KINDS
from app.modules.dashboard.router import router
from app.modules.dashboard.schemas import (
    AgencyDebtPoint,
    DashboardDrafts,
    DashboardResponse,
)

AS_OF = datetime(2026, 11, 14, 3, 0, tzinfo=UTC)


def test_month_bounds_current_month_and_twelve_month_trend():
    bounds, months = dashboard.month_bounds("2026-11")
    assert bounds == {"start": "2026-11-01", "end": "2026-12-01", "trendStart": "2025-12-01"}
    assert months[0] == "2025-12" and months[-1] == "2026-11" and len(months) == 12


def test_month_bounds_year_end_and_first_year_boundaries():
    bounds, months = dashboard.month_bounds("2026-12")
    assert bounds["end"] == "2027-01-01" and months[0] == "2026-01"
    bounds, months = dashboard.month_bounds("0001-03")
    assert months == ["0001-01", "0001-02", "0001-03"] and bounds["trendStart"] == "0001-01-01"
    bounds, _ = dashboard.month_bounds("9999-12")
    assert bounds["end"] == "10000-01-01"


@pytest.mark.parametrize("month", ["2026-13", "2026-00", "2026-1", "0000-05", 202611, None, ""])
def test_month_bounds_rejects_invalid_months(month):
    with pytest.raises(ApiError) as error:
        dashboard.month_bounds(month)
    assert (error.value.status, error.value.code) == (422, "VALIDATION_FAILED")


def test_permission_codes_are_registered_and_admission_covers_every_section():
    every = set().union(*dashboard.SECTION_READERS.values())
    assert every <= FUNCTION_CODES
    assert set(dashboard.ADMISSION) == every
    assert set(dashboard.DRAFT_READERS) == set(DRAFT_KINDS)
    assert "inventory.read" not in every and "cash.upfront.verify" not in every
    route = router.routes[0]
    assert route.openapi_extra["x-permissions"] == {"anyOf": list(dashboard.ADMISSION)}


def test_response_projects_only_present_sections():
    response = DashboardResponse.model_validate(
        {
            "month": "2026-11",
            "asOf": AS_OF,
            "agencies": {"total": 3, "active": 2},
            "drafts": {"stockIssues": 4},
        }
    )
    assert response.model_dump(mode="json") == {
        "month": "2026-11",
        "asOf": "2026-11-14T03:00:00+00:00",
        "agencies": {"total": 3, "active": 2},
        "drafts": {"stockIssues": 4},
    }
    assert DashboardDrafts().model_dump() == {}


def test_response_rejects_retired_sections_and_bad_counts():
    for extra in ({"inventory": {}}, {"receivables": {}}, {"pendingIssueCount": 1}):
        with pytest.raises(ValidationError):
            DashboardResponse.model_validate({"month": "2026-11", "asOf": AS_OF} | extra)
    with pytest.raises(ValidationError):
        DashboardDrafts(stockIssues=-1)


def point(**changes):
    values = {
        "agencyId": "1",
        "agencyCode": "DL-1",
        "agencyName": "Tạp hóa An",
        "debt": Decimal(10200000),
        "maxDebt": Decimal(10000000),
        "debtRatio": Decimal("102.00"),
    }
    return AgencyDebtPoint.model_validate(values | changes)


def test_debt_ratio_serializes_exactly_and_may_exceed_limit():
    assert point().model_dump(mode="json")["debtRatio"] == "102"
    assert point(debtRatio=Decimal("10.74")).model_dump(mode="json")["debtRatio"] == "10.74"
    assert point(debtRatio=None, maxDebt=Decimal(0)).model_dump(mode="json")["debtRatio"] is None
    assert point(debt=Decimal(-48000)).model_dump(mode="json")["debt"] == "-48000"


@pytest.mark.parametrize("ratio", [Decimal("1.005"), Decimal(-1), Decimal("NaN"), "10", 10.5])
def test_debt_ratio_rejects_invalid_values(ratio):
    with pytest.raises(ValidationError):
        point(debtRatio=ratio)


def test_invalid_month_or_token_fails_before_touching_the_database():
    engine = Mock()
    settings = Settings(
        _env_file=None,
        db_host="localhost",
        db_user="test",
        db_password="test",
        auth_signing_key="synthetic-test-key-32-bytes-or-more",
    )
    service = dashboard.DashboardService(engine, settings, Mock())
    with pytest.raises(ApiError):
        service.get("token", "2026-13")
    with pytest.raises(AuthError) as error:
        service.get("not-a-jwt", "2026-11")
    assert error.value.status == 401
    engine.connect.assert_not_called()
