from typing import Annotated, Literal

from pydantic import Field, WithJsonSchema

from app.common.catalogue import PatchModel
from app.common.schemas import (
    ApiModel,
    BusinessDate,
    CatalogId,
    Id,
    Instant,
    Money,
    NonEmptyText,
    Pagination,
    SignedMoney,
)
from app.modules.auth.schemas import EmailRequest, NonEmpty

Email = Annotated[NonEmpty, Field(pattern=r"^\S+@\S+$", json_schema_extra={"format": "email"})]
NullableText = Annotated[str | None, WithJsonSchema({"type": ["string", "null"]})]
NullableInstant = Annotated[
    Instant | None, WithJsonSchema({"type": ["string", "null"], "format": "date-time"})
]


class AgencyCreate(EmailRequest):
    name: NonEmptyText
    typeId: CatalogId
    wardId: CatalogId
    phone: NonEmptyText | None = None
    address: NullableText = None
    email: Email | None = None
    acceptedDate: BusinessDate


class AgencyUpdate(PatchModel, EmailRequest):
    name: NonEmptyText = None
    typeId: CatalogId = None
    wardId: CatalogId = None
    phone: NonEmptyText | None = None
    address: NullableText = None
    email: Email | None = None
    acceptedDate: BusinessDate = None


class Reason(ApiModel):
    reason: NonEmptyText


class AgencyResponse(ApiModel):
    id: Id
    code: str = Field(pattern=r"^DL-[1-9][0-9]*$", json_schema_extra={"readOnly": True})
    name: str
    typeId: CatalogId
    typeName: str
    wardId: CatalogId
    wardName: str
    phone: NullableText
    address: NullableText
    email: Email | None
    acceptedDate: BusinessDate
    status: Literal["ACTIVE", "TERMINATED"]
    terminatedAt: NullableInstant
    terminationReason: NullableText
    createdBy: Id | None
    updatedBy: Id | None
    debt: SignedMoney = Field(
        json_schema_extra={"readOnly": True},
        description="Current debt; negative only after a late verified online payment.",
    )
    maxDebt: Money
    remainingCreditLimit: SignedMoney
    createdAt: Instant = Field(json_schema_extra={"readOnly": True})
    updatedAt: Instant = Field(json_schema_extra={"readOnly": True})


class AgencyListResponse(ApiModel):
    items: list[AgencyResponse]
    pagination: Pagination
