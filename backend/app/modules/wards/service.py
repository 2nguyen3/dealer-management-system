from app.common.catalogue import CatalogueService
from app.modules.wards.repository import WardRepository
from app.modules.wards.schemas import WardListResponse, WardResponse


class WardService(CatalogueService):
    """Read-only catalogue: only list/get/etag are exposed; no writer is routed."""

    repository = WardRepository
    response_model = WardResponse
    list_model = WardListResponse
    permission = "agency.read"
    operation = "listWards"
