from app.common.catalogue import CatalogueService
from app.modules.districts.repository import DistrictRepository
from app.modules.districts.schemas import DistrictListResponse, DistrictResponse


class DistrictService(CatalogueService):
    repository = DistrictRepository
    response_model = DistrictResponse
    list_model = DistrictListResponse
    permission = "district.manage"
    operation = "listDistricts"
    conflicts = {
        ("23505", "district_code_key"): ("DUPLICATE", "District code already exists"),
        ("23505", "district_name_key"): ("DUPLICATE", "District name already exists"),
        ("23503", "agency_districtId_fkey"): ("RESOURCE_IN_USE", "District has agencies"),
    }
