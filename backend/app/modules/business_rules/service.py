from app.common.catalogue import CatalogueService
from app.common.preconditions import Preconditions, canonical_etag
from app.core.exceptions import ApiError
from app.modules.business_rules.repository import BusinessRuleRepository
from app.modules.business_rules.schemas import BusinessRuleResponse, BusinessRuleUpdate


class BusinessRuleService(CatalogueService):
    repository = BusinessRuleRepository
    permission = "rules.manage"

    def get(self):
        return BusinessRuleResponse.model_validate(self.repo.get())

    def etag(self, item):
        return canonical_etag("business-rules", item.model_dump(mode="json"))

    def update(self, body: BusinessRuleUpdate, condition: Preconditions):
        def work():
            self.repo.lock()
            self.authorize((self.permission,))
            condition.compare(self.etag(self.get()))
            values = body.model_dump(exclude_unset=True)
            if "maxAgenciesPerDistrict" in values:
                blockers = self.repo.blockers(values["maxAgenciesPerDistrict"])
                if blockers:
                    raise ApiError(
                        409,
                        "LIMIT_CONFLICT",
                        "District capacity would be exceeded",
                        details={"blockedDistricts": blockers},
                    )
            self.repo.update(values)
            return self.get

        return self.write(work)
