from typing import Annotated

from pydantic import Field

from app.common.catalogue import PatchModel
from app.common.schemas import ApiModel, Instant, PriceRate


class BusinessRuleUpdate(PatchModel):
    maxAgenciesPerDistrict: Annotated[int, Field(strict=True, ge=1, le=2147483647)] = None
    sellingPriceRate: PriceRate = None


class BusinessRuleResponse(ApiModel):
    maxAgenciesPerDistrict: int = Field(ge=1)
    sellingPriceRate: PriceRate
    createdAt: Instant = Field(json_schema_extra={"readOnly": True})
    updatedAt: Instant = Field(json_schema_extra={"readOnly": True})
