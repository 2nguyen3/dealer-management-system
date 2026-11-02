from pydantic import Field, model_validator

from app.common.schemas import ApiModel, CatalogId, Instant, NonEmptyText, Pagination


class GroupCreate(ApiModel):
    code: NonEmptyText
    name: NonEmptyText


class GroupUpdate(ApiModel):
    model_config = {"json_schema_extra": {"minProperties": 1}}
    # Omitted fields default internally to None; explicitly supplied null is
    # rejected by the nonnullable string type. Only model_fields_set is applied.
    code: NonEmptyText = None
    name: NonEmptyText = None

    @model_validator(mode="before")
    @classmethod
    def nonempty_patch(cls, value: object) -> object:
        if not isinstance(value, dict) or not value:
            raise ValueError("A nonempty update is required")
        return value


class GroupResponse(ApiModel):
    id: CatalogId
    code: str
    name: str
    userCount: int = Field(ge=0)
    createdAt: Instant = Field(json_schema_extra={"readOnly": True})
    updatedAt: Instant = Field(json_schema_extra={"readOnly": True})


class GroupListResponse(ApiModel):
    items: list[GroupResponse]
    pagination: Pagination
