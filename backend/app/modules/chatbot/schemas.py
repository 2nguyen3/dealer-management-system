"""Request/reply models of POST /chatbot/messages (plan/chatbot/chatbot.openapi.yaml)."""

from typing import Annotated, Literal

from pydantic import Field

from app.common.schemas import ApiModel

ColumnType = Literal[
    "code", "text", "money", "quantity", "integer", "rate", "date", "status", "kind"
]


class ChatTurn(ApiModel):
    role: Literal["user", "assistant"]
    content: Annotated[str, Field(min_length=1, max_length=2000)]


class ChatbotMessageRequest(ApiModel):
    messages: Annotated[list[ChatTurn], Field(min_length=1, max_length=20)]
    locale: Annotated[str, Field(pattern=r"^[a-z]{2,3}(-[A-Z]{2})?$")] = "vi"


class ChatbotColumn(ApiModel):
    key: Annotated[str, Field(pattern=r"^[A-Za-z]+$")]
    type: ColumnType


class ChatbotTable(ApiModel):
    title: str
    tool: Annotated[str, Field(pattern=r"^[a-z_]+$")]
    columns: Annotated[list[ChatbotColumn], Field(min_length=1)]
    rows: Annotated[list[dict[str, str | int | None]], Field(max_length=50)]
    totalRows: Annotated[int, Field(ge=0)]
    truncated: bool
    asOf: str


class ChatbotReply(ApiModel):
    answer: Annotated[str, Field(min_length=1, max_length=2000)]
    tables: Annotated[list[ChatbotTable], Field(max_length=3)]
    tools: list[str]
    model: str | None = None
