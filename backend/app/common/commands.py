import hashlib
import re
from dataclasses import dataclass
from uuid import UUID, uuid4, uuid5

from sqlalchemy import ForeignKey, Integer, LargeBinary, Text, UniqueConstraint, select, text
from sqlalchemy.dialects.postgresql import JSONB, insert
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.common.canonical import canonical_json, canonical_value
from app.common.schemas import ApiModel
from app.core.exceptions import ApiError
from app.db.base import Base, Timestamps


class ApiCommand(Timestamps, Base):
    __tablename__ = "api_idempotency"
    __table_args__ = (
        UniqueConstraint(
            "actorId", "operationId", "resourceScope", "clientKey", name="uq_api_idempotency_scope"
        ),
        {
            "schema": "dms",
            "comment": "Durable retry identity; safe typed results only; "
            "no generic expiry or credential storage.",
        },
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    actor_id: Mapped[int] = mapped_column(
        "actorId", ForeignKey("dms.app_user.id", ondelete="RESTRICT")
    )
    operation_id: Mapped[str] = mapped_column("operationId", Text)
    resource_scope: Mapped[str] = mapped_column("resourceScope", Text)
    client_key: Mapped[UUID] = mapped_column("clientKey")
    request_digest: Mapped[bytes] = mapped_column("requestDigest", LargeBinary)
    format_version: Mapped[int] = mapped_column("formatVersion", Integer, server_default=text("1"))
    state: Mapped[str] = mapped_column(Text, server_default=text("'CLAIMED'"))
    result: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True))
    recovery: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True))


@dataclass(frozen=True)
class CommandScope:
    actor_id: int
    operation_id: str
    resource_scope: str
    client_key: UUID

    def __post_init__(self) -> None:
        if (
            type(self.actor_id) is not int
            or self.actor_id < 1
            or self.actor_id > 9223372036854775807
            or not re.fullmatch(r"[A-Za-z][A-Za-z0-9]*", self.operation_id)
            or not self.resource_scope
            or not isinstance(self.client_key, UUID)
        ):
            raise ValueError("Invalid server-owned command scope")


class CommandResult(ApiModel):
    status: int
    body: dict | list | None = None
    headers: dict[str, str] = {}

    def checked(self) -> "CommandResult":
        if self.status not in (200, 201, 202, 204) or (
            self.status == 204 and self.body is not None
        ):
            raise ValueError("Invalid command success result")
        if not set(self.headers) <= {"ETag", "Location", "Content-Disposition"} or any(
            "\r" in value or "\n" in value for value in self.headers.values()
        ):
            raise ValueError("Unsafe command result headers")
        validate_safe_result(self.body)
        return self.model_copy(update={"body": canonical_value(self.body)})


def validate_safe_result(value: object) -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str) or any(
                secret in key.lower() for secret in ("password", "token", "secret", "digest")
            ):
                raise ValueError("Sensitive command result field")
            validate_safe_result(item)
    elif isinstance(value, list):
        for item in value:
            validate_safe_result(item)
    else:
        canonical_json(value)


def request_fingerprint(payload: object) -> bytes:
    """Fingerprint a validated/default-normalized payload; never persist raw input."""
    return hashlib.sha256(canonical_json(["command-v1", payload])).digest()


def internal_substep_key(command_id: UUID, substep: str) -> UUID:
    if not substep:
        raise ValueError("Named command substep required")
    return uuid5(command_id, substep)


class CommandRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def find(self, scope: CommandScope) -> ApiCommand | None:
        return self.session.scalar(
            select(ApiCommand)
            .where(
                ApiCommand.actor_id == scope.actor_id,
                ApiCommand.operation_id == scope.operation_id,
                ApiCommand.resource_scope == scope.resource_scope,
                ApiCommand.client_key == scope.client_key,
            )
            .execution_options(populate_existing=True)
        )

    def claim(self, scope: CommandScope, digest: bytes) -> tuple[ApiCommand, bool]:
        identifier = uuid4()
        inserted = self.session.scalar(
            insert(ApiCommand)
            .values(
                id=identifier,
                actor_id=scope.actor_id,
                operation_id=scope.operation_id,
                resource_scope=scope.resource_scope,
                client_key=scope.client_key,
                request_digest=digest,
            )
            .on_conflict_do_nothing(constraint="uq_api_idempotency_scope")
            .returning(ApiCommand.id)
        )
        command = self.find(scope)
        if command is None:
            raise RuntimeError("Command vanished after claim")
        if command.request_digest != digest:
            raise ApiError(409, "IDEMPOTENCY_KEY_REUSED", "Retry key was used for another payload")
        return command, inserted is not None

    def complete(
        self, command: ApiCommand, result: CommandResult, *, recovery: dict | None = None
    ) -> None:
        command.result = result.checked().model_dump(mode="json")
        if recovery is not None:
            validate_safe_result(recovery)
        command.recovery = recovery
        command.state = "COMPLETED" if recovery is None else "ACCEPTED"
        self.session.flush()
