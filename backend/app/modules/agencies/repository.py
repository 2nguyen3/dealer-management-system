from operator import ge, le, lt
from types import SimpleNamespace

from sqlalchemy import String, cast, select, text

from app.common.dates import parse_date
from app.common.sql_catalogue import SqlCatalogueRepository
from app.core.exceptions import ApiError
from app.modules.agencies.models import AGENCY
from app.modules.agency_types.models import AgencyType
from app.modules.wards.models import Ward


class AgencyRepository(SqlCatalogueRepository):
    table = AGENCY
    model = SimpleNamespace(id=AGENCY.c.id)
    columns = dict(AGENCY.c.items()) | {
        "typeName": AgencyType.name,
        "wardName": Ward.name,
        "maxDebt": AgencyType.max_debt,
        "remainingCreditLimit": AgencyType.max_debt - AGENCY.c.debt,
    }
    ranges = {
        "debtFrom": (AGENCY.c.debt, ge),
        "debtTo": (AGENCY.c.debt, le),
        "acceptedFrom": (AGENCY.c.acceptedDate, ge),
        "acceptedTo": (AGENCY.c.acceptedDate, lt),
    }

    def query(self):
        return select(
            *(
                cast(col, String).label(name)
                if name in {"id", "createdBy", "updatedBy"}
                else col.label(name)
                for name, col in self.columns.items()
            )
        ).select_from(
            AGENCY.join(AgencyType.__table__, AgencyType.id == AGENCY.c.typeId).join(
                Ward.__table__, Ward.id == AGENCY.c.wardId
            )
        )

    def masters(self, type_id: int, ward_id: int, *, new_type=False):
        kind = self.session.execute(
            text('SELECT id,status,"maxDebt" FROM dms.agency_type WHERE id=:id FOR SHARE'),
            {"id": type_id},
        ).one_or_none()
        # Wards are read-only reference rows without status; only existence matters.
        ward = self.session.execute(
            text("SELECT id FROM dms.ward WHERE id=:id FOR SHARE"), {"id": ward_id}
        ).one_or_none()
        if kind is None or ward is None:
            raise ApiError(404, "NOT_FOUND", "Agency master not found")
        if new_type and kind.status != "ACTIVE":
            raise ApiError(409, "INACTIVE_MASTER", "Agency master is inactive")
        return kind.maxDebt

    def lock(self, identifier: int):
        self.session.execute(text("SELECT id FROM dms.business_rule WHERE id FOR UPDATE"))
        current = (
            self.session.execute(select(AGENCY).where(AGENCY.c.id == identifier))
            .mappings()
            .one_or_none()
        )
        if current is None:
            return None
        self.masters(current["typeId"], current["wardId"])
        return super().lock(identifier)

    def capacity(self, ward_id: int, *, exclude: int = 0):
        maximum = self.session.scalar(
            text('SELECT "maxAgenciesPerWard" FROM dms.business_rule WHERE id')
        )
        count = self.session.scalar(
            text(
                'SELECT count(*) FROM dms.agency WHERE "wardId"=:ward '
                "AND status='ACTIVE' AND id<>:exclude"
            ),
            {"ward": ward_id, "exclude": exclude},
        )
        if count >= maximum:
            raise ApiError(
                409,
                "WARD_CAPACITY_EXCEEDED",
                "Ward has no remaining agency slots",
                details={
                    "wardId": ward_id,
                    "activeAgencyCount": count,
                    "maxAgencies": maximum,
                },
            )

    def prepare_create(self, values: dict) -> None:
        self.session.execute(text("SELECT id FROM dms.business_rule WHERE id FOR UPDATE"))
        self.masters(values["typeId"], values["wardId"], new_type=True)
        self.capacity(values["wardId"])

    def validate_update(self, row, values: dict):
        type_id = values.get("typeId", row.typeId)
        ward_id = values.get("wardId", row.wardId)
        maximum = self.masters(type_id, ward_id, new_type=type_id != row.typeId)
        debt = self.session.scalar(
            text("SELECT debt FROM dms.agency WHERE id=:id"),
            {"id": row.id},
        )
        if debt > maximum:
            raise ApiError(409, "LIMIT_CONFLICT", "New agency type limit is below current debt")
        if ward_id != row.wardId and row.status == "ACTIVE":
            self.capacity(ward_id, exclude=row.id)
        if "acceptedDate" in values:
            values["acceptedDate"] = parse_date(values["acceptedDate"])
            earliest = self.session.scalar(
                text('SELECT min("businessDate") FROM dms.document WHERE "agencyId"=:id'),
                {"id": row.id},
            )
            if earliest is not None and values["acceptedDate"] > earliest:
                raise ApiError(
                    409, "AGENCY_CONFLICT", "Accepted date is after existing document history"
                )

    def references(self, identifier: int) -> bool:
        return bool(
            self.session.scalar(
                text(
                    'SELECT EXISTS(SELECT 1 FROM dms.document WHERE "agencyId"=:id) '
                    'OR EXISTS(SELECT 1 FROM dms.online_payment WHERE "agencyId"=:id)'
                ),
                {"id": identifier},
            )
        )
