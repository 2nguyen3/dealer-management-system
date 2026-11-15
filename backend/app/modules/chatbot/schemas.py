"""Request/reply models of POST /chatbot/messages (plan/chatbot/chatbot.openapi.yaml)."""

from typing import Annotated, Literal

from pydantic import Field

from app.common.schemas import ApiModel

Entity = Literal["agency", "product"]
Metric = Literal["DEBT", "INVENTORY", "SALES"]
Op = Literal["eq", "gt", "gte", "lt", "lte"]
AnswerText = Annotated[str, Field(min_length=1, max_length=2000)]
Key = Annotated[str, Field(pattern=r"^[A-Za-z]+$")]


class ChatTurn(ApiModel):
    role: Literal["user", "assistant"]
    content: Annotated[str, Field(min_length=1, max_length=2000)]


class ChatbotPeriod(ApiModel):
    fromDate: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")]
    toDate: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")]


class SemanticFilter(ApiModel):
    field: Key
    op: Op
    value: Annotated[str, Field(min_length=1, max_length=120)]


class SemanticQuery(ApiModel):
    metric: Metric
    groupBy: Entity | None = None
    period: ChatbotPeriod | None = None
    filters: Annotated[list[SemanticFilter], Field(max_length=5)]
    sort: Annotated[str, Field(pattern=r"^-?[A-Za-z]+$")] | None = None
    limit: Annotated[int, Field(ge=1, le=50)] = 20


class ChatbotSelection(ApiModel):
    entity: Entity
    code: Annotated[str, Field(min_length=1, max_length=32)]


class ChatbotResume(ApiModel):
    query: SemanticQuery
    select: ChatbotSelection


class ChatbotMessageRequest(ApiModel):
    messages: Annotated[list[ChatTurn], Field(min_length=1, max_length=20)]
    resume: ChatbotResume | None = None
    locale: Annotated[str, Field(pattern=r"^[a-z]{2,3}(-[A-Z]{2})?$")] = "vi"


class ChatbotColumn(ApiModel):
    key: Key
    type: Literal["code", "text", "money", "quantity", "integer", "rate"]


class ChatbotSource(ApiModel):
    operationId: Literal[
        "listAgencies",
        "listProducts",
        "getDebtReport",
        "getInventoryReport",
        "getSalesReport",
        "getProductSalesReport",
    ]
    query: dict[str, str]


class ChatbotTable(ApiModel):
    title: str
    understood: SemanticQuery
    columns: Annotated[list[ChatbotColumn], Field(min_length=1)]
    rows: Annotated[list[dict[str, str | int | None]], Field(max_length=50)]
    totalRows: Annotated[int, Field(ge=0)]
    truncated: bool
    asOf: str
    source: ChatbotSource


class ChatbotCandidate(ApiModel):
    code: str
    name: str
    detail: str | None


class ChatbotAnswered(ApiModel):
    status: Literal["ANSWERED"]
    answer: AnswerText
    tables: Annotated[list[ChatbotTable], Field(min_length=1, max_length=3)]
    model: str | None = None


class ChatbotNeedsSelection(ApiModel):
    status: Literal["NEEDS_SELECTION"]
    answer: AnswerText
    entity: Entity
    candidates: Annotated[list[ChatbotCandidate], Field(min_length=2, max_length=10)]
    totalMatches: Annotated[int, Field(ge=2)]
    pendingQuery: SemanticQuery


class ChatbotNeedsInfo(ApiModel):
    status: Literal["NEEDS_INFO"]
    answer: AnswerText
    missing: Annotated[list[Literal["metric", "period", "agency", "product"]], Field(min_length=1)]


class ChatbotRefused(ApiModel):
    status: Literal["REFUSED"]
    answer: AnswerText
    reason: Literal["UNSUPPORTED_QUERY", "FORBIDDEN_METRIC", "NO_MATCH"]


ChatbotReply = Annotated[
    ChatbotAnswered | ChatbotNeedsSelection | ChatbotNeedsInfo | ChatbotRefused,
    Field(discriminator="status"),
]
