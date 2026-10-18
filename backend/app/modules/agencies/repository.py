from operator import ge, le, lt
from types import SimpleNamespace

from sqlalchemy import String, cast, select, text

from app.common.dates import parse_date
from app.common.sql_catalogue import SqlCatalogueRepository
from app.core.exceptions import ApiError
from app.modules.agencies.models import AGENCY, BALANCE
from app.modules.agency_types.models import AgencyType
from app.modules.districts.models import District


class AgencyRepository(SqlCatalogueRepository):
    table = AGENCY
    model = SimpleNamespace(id=AGENCY.c.id)
    columns = dict(AGENCY.c.items()) | {
        "typeName": AgencyType.name,
        "districtName": District.name,
        "maxDebt": AgencyType.max_debt,
        "currentDebt": BALANCE.c.currentDebt,
        "currentCredit": BALANCE.c.currentCredit,
        "remainingCreditLimit": AgencyType.max_debt - BALANCE.c.currentDebt,
    }
    ranges = {
        "debtFrom": (BALANCE.c.currentDebt, ge),
        "debtTo": (BALANCE.c.currentDebt, le),
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
            AGENCY.join(AgencyType.__table__, AgencyType.id == AGENCY.c.typeId)
            .join(District.__table__, District.id == AGENCY.c.districtId)
            .join(BALANCE, BALANCE.c.agencyId == AGENCY.c.id)
        )

    def masters(self, type_id: int, district_id: int, *, new_type=False, new_district=False):
        kind = self.session.execute(
            text('SELECT id,status,"maxDebt" FROM dms.agency_type WHERE id=:id FOR SHARE'),
            {"id": type_id},
        ).one_or_none()
        district = self.session.execute(
            text("SELECT id,status FROM dms.district WHERE id=:id FOR UPDATE"), {"id": district_id}
        ).one_or_none()
        if kind is None or district is None:
            raise ApiError(404, "NOT_FOUND", "Agency master not found")
        if (new_type and kind.status != "ACTIVE") or (new_district and district.status != "ACTIVE"):
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
        self.masters(current["typeId"], current["districtId"])
        row = super().lock(identifier)
        self.session.execute(
            text('SELECT "agencyId" FROM dms.agency_balance WHERE "agencyId"=:id FOR UPDATE'),
            {"id": identifier},
        )
        return row

    def capacity(self, district_id: int, *, exclude: int = 0):
        maximum = self.session.scalar(
            text('SELECT "maxAgenciesPerDistrict" FROM dms.business_rule WHERE id')
        )
        count = self.session.scalar(
            text(
                'SELECT count(*) FROM dms.agency WHERE "districtId"=:district '
                "AND status='ACTIVE' AND id<>:exclude"
            ),
            {"district": district_id, "exclude": exclude},
        )
        if count >= maximum:
            raise ApiError(
                409,
                "DISTRICT_CAPACITY_EXCEEDED",
                "District has no remaining agency slots",
                details={
                    "districtId": district_id,
                    "activeAgencyCount": count,
                    "maxAgencies": maximum,
                },
            )

    def prepare_create(self, values: dict) -> None:
        self.session.execute(text("SELECT id FROM dms.business_rule WHERE id FOR UPDATE"))
        self.masters(values["typeId"], values["districtId"], new_type=True, new_district=True)
        self.capacity(values["districtId"])

    def validate_update(self, row, values: dict):
        type_id = values.get("typeId", row.typeId)
        district_id = values.get("districtId", row.districtId)
        maximum = self.masters(
            type_id,
            district_id,
            new_type=type_id != row.typeId,
            new_district=district_id != row.districtId and row.status == "ACTIVE",
        )
        debt = self.session.scalar(
            text('SELECT "currentDebt" FROM dms.agency_balance WHERE "agencyId"=:id'),
            {"id": row.id},
        )
        if debt > maximum:
            raise ApiError(409, "LIMIT_CONFLICT", "New agency type limit is below current debt")
        if district_id != row.districtId and row.status == "ACTIVE":
            self.capacity(district_id, exclude=row.id)
        if "acceptedDate" in values:
            values["acceptedDate"] = parse_date(values["acceptedDate"])
            earliest = self.session.scalar(
                text(
                    'SELECT min(r."businessDate") FROM dms.document d '
                    'JOIN dms.document_revision r ON r."documentId"=d.id WHERE d."agencyId"=:id'
                ),
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
                    'OR EXISTS(SELECT 1 FROM dms.online_payment WHERE "agencyId"=:id) '
                    'OR EXISTS(SELECT 1 FROM dms.credit_lot WHERE "agencyId"=:id) '
                    'OR EXISTS(SELECT 1 FROM dms.receivable_entry WHERE "agencyId"=:id) '
                    'OR EXISTS(SELECT 1 FROM dms.credit_entry WHERE "agencyId"=:id)'
                ),
                {"id": identifier},
            )
        )
