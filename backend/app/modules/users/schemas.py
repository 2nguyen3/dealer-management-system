from typing import Annotated, Literal

from pydantic import Field

from app.common.catalogue import PatchModel
from app.common.schemas import ApiModel, CatalogId, NonEmptyText, Pagination
from app.modules.auth.schemas import EmailRequest, NonEmpty, UserResponse


class UserCreate(EmailRequest):
    fullName: NonEmptyText
    password: NonEmpty = Field(repr=False, json_schema_extra={"writeOnly": True})
    groupId: CatalogId
    status: Literal["ACTIVE", "LOCKED"] = "ACTIVE"


class UserUpdate(PatchModel, EmailRequest):
    fullName: NonEmptyText = None
    email: Annotated[
        NonEmpty, Field(pattern=r"^\S+@\S+$", json_schema_extra={"format": "email"})
    ] = None
    groupId: CatalogId = None
    status: Literal["ACTIVE", "LOCKED"] = None


class AdminPasswordReset(ApiModel):
    newPassword: NonEmpty = Field(repr=False, json_schema_extra={"writeOnly": True})


class UserListResponse(ApiModel):
    items: list[UserResponse]
    pagination: Pagination
