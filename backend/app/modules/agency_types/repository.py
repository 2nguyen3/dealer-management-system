from decimal import Decimal

from sqlalchemy import Integer, literal_column, text

from app.common.catalogue import CatalogueRepository
from app.core.exceptions import ApiError
from app.modules.agency_types.models import AgencyType


class AgencyTypeRepository(CatalogueRepository):
    model = AgencyType
    columns = {
        "id": AgencyType.id,
        "code": AgencyType.code,
        "name": AgencyType.name,
        "status": AgencyType.status,
        "maxDebt": AgencyType.max_debt,
        "createdAt": AgencyType.created_at,
        "updatedAt": AgencyType.updated_at,
    }

    def query(self):
        count = literal_column(
            '(SELECT count(*) FROM dms.agency a WHERE a."typeId"=dms.agency_type.id)', Integer
        )
        active = literal_column(
            "(SELECT count(*) FROM dms.agency a WHERE "
            "a.\"typeId\"=dms.agency_type.id AND a.status='ACTIVE')",
            Integer,
        )
        return (
            super()
            .query()
            .add_columns(count.label("agencyCount"), active.label("activeAgencyCount"))
        )

    def create(self, values: dict) -> int:
        values = {**values, "max_debt": values["maxDebt"]}
        del values["maxDebt"]
        return super().create(values)

    def references(self, identifier: int) -> bool:
        return bool(
            self.session.scalar(
                text('SELECT EXISTS (SELECT 1 FROM dms.agency WHERE "typeId"=:id)'),
                {"id": identifier},
            )
        )

    def lock_balances(self, identifier: int):
        return self.session.execute(
            text(
                'SELECT a.id,a.code,b."currentDebt" FROM dms.agency a '
                'JOIN dms.agency_balance b ON b."agencyId"=a.id WHERE a."typeId"=:id '
                "ORDER BY a.id FOR UPDATE OF b"
            ),
            {"id": identifier},
        ).all()

    def validate_update(self, row: AgencyType, values: dict, balances) -> None:
        if "maxDebt" in values:
            blocking = [
                {"agencyId": str(id), "agencyCode": code, "currentDebt": str(debt)}
                for id, code, debt in balances
                if debt > Decimal(values["maxDebt"])
            ]
            if blocking:
                raise ApiError(
                    409,
                    "DEBT_LIMIT_BELOW_CURRENT_BALANCE",
                    "Debt limit is below current agency debt",
                    details={
                        "typeId": row.id,
                        "requestedMaxDebt": str(values["maxDebt"]),
                        "blockingAgencies": blocking,
                    },
                )
