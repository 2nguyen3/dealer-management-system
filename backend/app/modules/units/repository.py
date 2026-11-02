from sqlalchemy import Integer, literal_column, text

from app.common.catalogue import CatalogueRepository
from app.core.exceptions import ApiError
from app.modules.units.models import Unit


class UnitRepository(CatalogueRepository):
    model = Unit
    columns = {
        "id": Unit.id,
        "code": Unit.code,
        "name": Unit.name,
        "status": Unit.status,
        "allowsFraction": Unit.allows_fraction,
        "createdAt": Unit.created_at,
        "updatedAt": Unit.updated_at,
    }

    def query(self):
        count = literal_column(
            '(SELECT count(*) FROM dms.product p WHERE p."unitId"=dms.unit.id)', Integer
        )
        return super().query().add_columns(count.label("productCount"))

    def create(self, values: dict) -> int:
        values = {**values, "allows_fraction": values["allowsFraction"]}
        del values["allowsFraction"]
        return super().create(values)

    def recorded(self, identifier: int) -> bool:
        return bool(
            self.session.scalar(
                text(
                    'SELECT EXISTS (SELECT 1 FROM dms.document_line WHERE "unitId"=:id) '
                    'OR EXISTS (SELECT 1 FROM dms.stock_count_line WHERE "unitId"=:id)'
                ),
                {"id": identifier},
            )
        )

    def references(self, identifier: int) -> bool:
        return bool(
            self.session.scalar(
                text('SELECT EXISTS (SELECT 1 FROM dms.product WHERE "unitId"=:id)'),
                {"id": identifier},
            )
        ) or self.recorded(identifier)

    def validate_update(self, row: Unit, values: dict) -> None:
        if (
            "allowsFraction" in values
            and values["allowsFraction"] != row.allows_fraction
            and self.recorded(row.id)
        ):
            raise ApiError(409, "MASTER_CONFLICT", "Recorded unit fraction policy cannot change")
