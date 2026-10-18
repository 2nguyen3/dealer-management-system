from app.common.catalogue import CatalogueService
from app.modules.agency_types.models import AgencyType
from app.modules.agency_types.repository import AgencyTypeRepository
from app.modules.agency_types.schemas import AgencyTypeListResponse, AgencyTypeResponse


class AgencyTypeService(CatalogueService):
    repository = AgencyTypeRepository
    response_model = AgencyTypeResponse
    list_model = AgencyTypeListResponse
    permission = "agency_type.manage"
    operation = "listAgencyTypes"
    sorts = {
        sort: (field,) if field == "id" else (field, "id")
        for field in ("id", "name", "maxDebt")
        for sort in (field, "-" + field)
    }
    conflicts = {
        ("23505", "agency_type_code_key"): ("DUPLICATE", "Type code already exists"),
        ("23505", "agency_type_name_key"): ("DUPLICATE", "Type name already exists"),
        ("23503", "agency_typeId_fkey"): ("RESOURCE_IN_USE", "Type has agencies"),
    }

    def validate_update(self, row: AgencyType, values: dict) -> None:
        balances = self.repo.lock_balances(row.id) if "maxDebt" in values else []
        self.authorize((self.permission,))
        self.repo.validate_update(row, values, balances)
