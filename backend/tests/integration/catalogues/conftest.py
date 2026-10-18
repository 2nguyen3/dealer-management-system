import pytest
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.modules.agency_types.service import AgencyTypeService
from app.modules.districts.service import DistrictService
from app.modules.units.service import UnitService
from app.modules.users.service import UserAdministrationService
from tests.integration.user_groups.conftest import (  # noqa: F401
    actor,
    client,
    database_factory,
    engine,
)

CASES = {
    "districts": (DistrictService, "District", {"code": "NEW", "name": "New"}),
    "agency-types": (
        AgencyTypeService,
        "AgencyType",
        {"code": "NEW", "name": "New", "maxDebt": "0"},
    ),
    "units": (UnitService, "Unit", {"code": "NEW", "name": "New"}),
    "users": (
        UserAdministrationService,
        "User",
        {"fullName": "New", "email": "new@example.com", "password": "x", "groupId": 2},
    ),
}


@pytest.fixture(params=list(CASES))
def resource(request):
    return request.param


@pytest.fixture
def use_case(engine, actor, resource):  # noqa: F811
    with Session(engine) as session:
        yield CASES[resource][0](
            session, CursorCodec(b"x" * 32), actor, "catalogue-request", lambda _: None
        )
