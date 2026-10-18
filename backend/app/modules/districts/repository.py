from sqlalchemy import Integer, literal_column, text

from app.common.catalogue import CatalogueRepository
from app.modules.districts.models import District


class DistrictRepository(CatalogueRepository):
    model = District
    columns = {
        "id": District.id,
        "code": District.code,
        "name": District.name,
        "status": District.status,
        "createdAt": District.created_at,
        "updatedAt": District.updated_at,
    }

    def query(self):
        count = literal_column(
            "(SELECT count(*) FROM dms.agency a WHERE "
            "a.\"districtId\"=dms.district.id AND a.status='ACTIVE')",
            Integer,
        )
        maximum = literal_column(
            '(SELECT "maxAgenciesPerDistrict" FROM dms.business_rule WHERE id)', Integer
        )
        return (
            super()
            .query()
            .add_columns(
                count.label("activeAgencyCount"),
                maximum.label("maxAgencies"),
                (maximum - count).label("remainingSlots"),
            )
        )

    def lock(self, identifier: int):
        self.session.execute(text("SELECT id FROM dms.business_rule WHERE id FOR SHARE"))
        return super().lock(identifier)

    def references(self, identifier: int) -> bool:
        return bool(
            self.session.scalar(
                text('SELECT EXISTS (SELECT 1 FROM dms.agency WHERE "districtId"=:id)'),
                {"id": identifier},
            )
        )

    def validate_update(self, row: District, values: dict) -> None:
        # Inactivation intentionally preserves existing agency records.
        pass
