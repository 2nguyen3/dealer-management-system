from sqlalchemy import Integer, literal_column

from app.common.catalogue import CatalogueRepository
from app.modules.wards.models import Ward


class WardRepository(CatalogueRepository):
    model = Ward
    columns = {
        "id": Ward.id,
        "code": Ward.code,
        "name": Ward.name,
        "kind": Ward.kind,
        "createdAt": Ward.created_at,
        "updatedAt": Ward.updated_at,
    }

    def query(self):
        count = literal_column(
            "(SELECT count(*) FROM dms.agency a WHERE "
            "a.\"wardId\"=dms.ward.id AND a.status='ACTIVE')",
            Integer,
        )
        maximum = literal_column(
            '(SELECT "maxAgenciesPerWard" FROM dms.business_rule WHERE id)', Integer
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
