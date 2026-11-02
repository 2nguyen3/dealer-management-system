from operator import ge, le
from types import SimpleNamespace

from sqlalchemy import String, cast, func, literal_column, select, text, true
from sqlalchemy.dialects.postgresql import JSONB

from app.common.sql_catalogue import SqlCatalogueRepository
from app.core.exceptions import ApiError
from app.modules.products.models import BALANCE, PRODUCT, RULE
from app.modules.units.models import Unit


class ProductRepository(SqlCatalogueRepository):
    table = PRODUCT
    model = SimpleNamespace(id=PRODUCT.c.id)
    columns = dict(PRODUCT.c.items()) | {
        "unitName": Unit.name,
        "allowsFraction": Unit.allows_fraction,
        "currentStock": BALANCE.c.currentStock,
        "currentPurchasePrice": BALANCE.c.currentPurchasePrice,
        "currentSellingPrice": func.round(
            BALANCE.c.currentPurchasePrice * RULE.c.sellingPriceRate, 0
        ),
        "isLowStock": BALANCE.c.currentStock < PRODUCT.c.lowStockThreshold,
    }
    ranges = {"stockFrom": (BALANCE.c.currentStock, ge), "stockTo": (BALANCE.c.currentStock, le)}

    def query(self):
        source = literal_column(
            """(SELECT jsonb_build_object(
          'documentId',d.id::text,'documentCode',d.code,'revisionNo',r."revisionNo",
          'lineId',l.id::text,'businessDate',r."businessDate"::text)
          FROM dms.document_line l JOIN dms.document_revision r ON r.id=l."revisionId"
          JOIN dms.document d ON d.id=r."documentId"
          WHERE l.id=dms.inventory_balance."priceSourceLineId")""",
            JSONB,
        )
        return select(
            cast(PRODUCT.c.id, String).label("id"),
            *(col.label(name) for name, col in self.columns.items() if name != "id"),
            source.label("priceSource"),
        ).select_from(
            PRODUCT.join(Unit.__table__, Unit.id == PRODUCT.c.unitId)
            .join(BALANCE, BALANCE.c.productId == PRODUCT.c.id)
            .join(RULE, true())
        )

    def lock(self, identifier: int):
        self.session.execute(text("SELECT id FROM dms.business_rule WHERE id FOR SHARE"))
        row = super().lock(identifier)
        if row is not None:
            self.unit(row.unitId, active=False)
            self.session.execute(
                text(
                    'SELECT "productId" FROM dms.inventory_balance WHERE "productId"=:id FOR UPDATE'
                ),
                {"id": identifier},
            )
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
                text(
                    'SELECT EXISTS(SELECT 1 FROM dms.document_line WHERE "productId"=:id) '
                    'OR EXISTS(SELECT 1 FROM dms.stock_count_line WHERE "productId"=:id)'
                ),
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
