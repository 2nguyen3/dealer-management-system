from app.common.catalogue import CatalogueService
from app.modules.units.repository import UnitRepository
from app.modules.units.schemas import UnitListResponse, UnitResponse


class UnitService(CatalogueService):
    repository = UnitRepository
    response_model = UnitResponse
    list_model = UnitListResponse
    permission = "unit.manage"
    operation = "listUnits"
    conflicts = {
        ("23514", "ck_unit_recorded_fraction_policy"): (
            "MASTER_CONFLICT",
            "Recorded unit fraction policy cannot change",
        ),
        ("23505", "unit_code_key"): ("DUPLICATE", "Unit code already exists"),
        ("23505", "unit_name_key"): ("DUPLICATE", "Unit name already exists"),
        ("23503", "product_unitId_fkey"): ("RESOURCE_IN_USE", "Unit has products"),
        ("23503", "document_line_unitId_fkey"): ("RESOURCE_IN_USE", "Unit has lines"),
        ("23503", "stock_count_line_unitId_fkey"): ("RESOURCE_IN_USE", "Unit has counts"),
    }
