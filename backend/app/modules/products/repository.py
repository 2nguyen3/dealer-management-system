from operator import ge, le
from types import SimpleNamespace

from sqlalchemy import String, cast, func, select, text, true

from app.common.sql_catalogue import SqlCatalogueRepository
from app.core.exceptions import ApiError
from app.modules.products.models import PRODUCT, RULE
from app.modules.units.models import Unit


class ProductRepository(SqlCatalogueRepository):
    table = PRODUCT
    model = SimpleNamespace(id=PRODUCT.c.id)
    columns = dict(PRODUCT.c.items()) | {
        "unitName": Unit.name,
        "allowsFraction": Unit.allows_fraction,
        "sellingPrice": func.round(PRODUCT.c.lastPurchasePrice * RULE.c.sellingPriceRate, 0),
    }
    ranges = {"stockFrom": (PRODUCT.c.stock, ge), "stockTo": (PRODUCT.c.stock, le)}

    def query(self):
        return select(
            cast(PRODUCT.c.id, String).label("id"),
            *(col.label(name) for name, col in self.columns.items() if name != "id"),
        ).select_from(PRODUCT.join(Unit.__table__, Unit.id == PRODUCT.c.unitId).join(RULE, true()))

    def lock(self, identifier: int):
        self.session.execute(text("SELECT id FROM dms.business_rule WHERE id FOR SHARE"))
        row = super().lock(identifier)
        if row is not None:
            self.unit(row.unitId, active=False)
        return row

    def unit(self, identifier: int, *, active: bool = True):
        row = self.session.execute(
            text("SELECT id,status FROM dms.unit WHERE id=:id FOR SHARE"), {"id": identifier}
        ).one_or_none()
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Unit not found")
        if active and row.status != "ACTIVE":
            raise ApiError(409, "INACTIVE_MASTER", "Unit is inactive")

    def recorded(self, identifier: int) -> bool:
        return bool(
            self.session.scalar(
                text('SELECT EXISTS(SELECT 1 FROM dms.document_line WHERE "productId"=:id)'),
                {"id": identifier},
            )
        )

    def references(self, identifier: int) -> bool:
        return self.recorded(identifier)

    def validate_update(self, row, values: dict):
        if "unitId" in values and values["unitId"] != row.unitId:
            if self.recorded(row.id):
                raise ApiError(409, "USED_UNIT_IMMUTABLE", "Recorded product unit cannot change")
            self.unit(values["unitId"])
