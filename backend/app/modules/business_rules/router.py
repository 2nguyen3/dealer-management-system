from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.common.catalogue_http import MatchHeader, responses
from app.common.preconditions import read_preconditions
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.business_rules.dependencies import get_business_rule_service
from app.modules.business_rules.schemas import BusinessRuleResponse, BusinessRuleUpdate
from app.modules.business_rules.service import BusinessRuleService

router = APIRouter(prefix="/business-rules", tags=["Business Rules"], route_class=BusinessRoute)
READ = {"anyOf": ["rules.manage", "agency.manage", "stock.issue.prepare", "inventory.read"]}
WRITE = {"allOf": ["rules.manage"]}
Reader = Annotated[Principal, Depends(require_permissions(any_of=tuple(READ["anyOf"])))]
Writer = Annotated[Principal, Depends(require_permissions(all_of=("rules.manage",)))]
Service = Annotated[BusinessRuleService, Depends(get_business_rule_service)]


@router.get(
    "",
    operation_id="getBusinessRules",
    response_model=BusinessRuleResponse,
    responses=responses(200, 401, 403, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ},
)
def get_business_rules(principal: Reader, service: Service, response: Response):
    item = service.get()
    response.headers["ETag"] = service.etag(item)
    return item


@router.patch(
    "",
    operation_id="updateBusinessRules",
    response_model=BusinessRuleResponse,
    responses=responses(200, 400, 401, 403, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def update_business_rules(
    body: BusinessRuleUpdate,
    principal: Writer,
    service: Service,
    request: Request,
    response: Response,
    match: MatchHeader,
):
    item = service.update(body, read_preconditions(request))
    response.headers["ETag"] = service.etag(item)
    return item
