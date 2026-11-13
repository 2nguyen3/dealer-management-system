from sqlalchemy import text
from sqlalchemy.orm import Session


class BusinessRuleRepository:
    def __init__(self, session: Session):
        self.session = session

    def get(self):
        return dict(
            self.session.execute(
                text(
                    'SELECT "maxAgenciesPerWard", "sellingPriceRate", "createdAt", "updatedAt" '
                    "FROM dms.business_rule WHERE id"
                )
            )
            .mappings()
            .one()
        )

    def lock(self):
        self.session.execute(text("SELECT id FROM dms.business_rule WHERE id FOR UPDATE")).one()

    def blockers(self, maximum: int):
        return [
            dict(row)
            for row in self.session.execute(
                text(
                    'SELECT w.id AS "wardId",w.code,w.name,count(*) AS "activeAgencyCount" '
                    'FROM dms.ward w JOIN dms.agency a ON a."wardId"=w.id '
                    "WHERE a.status='ACTIVE' GROUP BY w.id HAVING count(*)>:maximum ORDER BY w.id"
                ),
                {"maximum": maximum},
            ).mappings()
        ]

    def update(self, values: dict):
        # Names come only from validated, feature-owned request fields.
        assignments = ", ".join(f'"{name}"=:{name}' for name in values)
        self.session.execute(text(f"UPDATE dms.business_rule SET {assignments} WHERE id"), values)
