"""Cross-kind document history contract: search, detail, replacement chain."""

from typing import Literal

from app.common.schemas import ApiModel, NullableText
from app.modules.document_core.schemas import DocumentSummary

HistorySort = Literal[
    "id",
    "-id",
    "businessDate",
    "-businessDate",
    "totalAmount",
    "-totalAmount",
    "createdAt",
    "-createdAt",
    "postedAt",
    "-postedAt",
]


class ChainItem(DocumentSummary):
    cancelReason: NullableText


class DocumentChain(ApiModel):
    """Replacement chain ordered from the original document to the latest replacement."""

    items: list[ChainItem]
