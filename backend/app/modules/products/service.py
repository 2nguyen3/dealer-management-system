from app.common.catalogue import CatalogueService
from app.core.exceptions import ApiError
from app.modules.products.repository import ProductRepository
from app.modules.products.schemas import ProductListResponse, ProductResponse


class ProductService(CatalogueService):
    repository = ProductRepository
    response_model = ProductResponse
    list_model = ProductListResponse
    permission = "product.manage"
    operation = "listProducts"
    sorts = {
        sort: (field,) if field == "id" else (field, "id")
        for field in ("id", "name", "currentStock", "currentSellingPrice")
        for sort in (field, "-" + field)
    }
    conflicts = {
        ("23514", "ck_owner_eligible_deletion"): ("RESOURCE_IN_USE", "Product has usage"),
        ("23514", "ck_product_recorded_unit_policy"): (
            "USED_UNIT_IMMUTABLE",
            "Product unit is recorded",
        ),
    }

    def list(self, *, stockFrom=None, stockTo=None, **filters):
        if stockFrom is not None and stockTo is not None and stockFrom > stockTo:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid stock interval")
        return super().list(stockFrom=stockFrom, stockTo=stockTo, **filters)

    def create(self, body):
        def work():
            values = body.model_dump()
            self.repo.unit(values["unitId"])
            self.authorize((self.permission,))
            identifier = self.repo.create(values)
            return lambda: self.get(identifier)

        return self.write(work)
