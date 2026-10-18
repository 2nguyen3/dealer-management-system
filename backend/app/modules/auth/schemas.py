from datetime import datetime
from typing import Annotated, Literal

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.auth.permissions import FunctionCode
from app.modules.user_groups.models import UserGroup
from app.modules.users.models import AppUser

NonEmpty = Annotated[str, Field(strict=True, min_length=1)]


class AuthRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, hide_input_in_errors=True)


class EmailRequest(AuthRequest):
    email: Annotated[NonEmpty, Field(pattern=r"^\S+@\S+$", json_schema_extra={"format": "email"})]

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        try:
            validate_email(value, check_deliverability=False)
        except EmailNotValidError:
            raise ValueError("Invalid email") from None
        return value


class LoginRequest(EmailRequest):
    password: NonEmpty = Field(repr=False, json_schema_extra={"writeOnly": True})


class RefreshRequest(AuthRequest):
    refreshToken: NonEmpty = Field(repr=False, json_schema_extra={"writeOnly": True})


class ChangePasswordRequest(AuthRequest):
    currentPassword: NonEmpty = Field(repr=False, json_schema_extra={"writeOnly": True})
    newPassword: NonEmpty = Field(repr=False, json_schema_extra={"writeOnly": True})


class PasswordResetRequest(AuthRequest):
    token: NonEmpty = Field(repr=False, json_schema_extra={"writeOnly": True})
    newPassword: NonEmpty = Field(repr=False, json_schema_extra={"writeOnly": True})


class UserResponse(BaseModel):
    id: str = Field(pattern=r"^[1-9][0-9]{0,18}$")
    fullName: str
    email: str = Field(pattern=r"^\S+@\S+$", json_schema_extra={"format": "email"})
    groupId: int = Field(ge=1, le=2147483647)
    groupCode: str
    groupName: str
    status: Literal["ACTIVE", "LOCKED"]
    createdAt: datetime = Field(json_schema_extra={"readOnly": True})
    updatedAt: datetime = Field(json_schema_extra={"readOnly": True})


class TokenResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    accessToken: str = Field(repr=False)
    tokenType: Literal["Bearer"]
    expiresAt: datetime
    refreshToken: str = Field(repr=False)
    refreshExpiresAt: datetime
    user: UserResponse


class CurrentUser(BaseModel):
    user: UserResponse
    allowedFunctions: list[FunctionCode] = Field(json_schema_extra={"uniqueItems": True})

    @field_validator("allowedFunctions")
    @classmethod
    def unique_functions(cls, value: list[FunctionCode]) -> list[FunctionCode]:
        if len(value) != len(set(value)):
            raise ValueError("Permission codes must be unique")
        return value


class AcceptedMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str
    requestId: str


def to_user_response(user: AppUser, group: UserGroup) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        fullName=user.full_name,
        email=user.email,
        groupId=group.id,
        groupCode=group.code,
        groupName=group.name,
        status=user.status,
        createdAt=user.created_at,
        updatedAt=user.updated_at,
    )
