from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    LargeBinary,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps


class AppFunction(Timestamps, Base):
    __tablename__ = "app_function"
    __table_args__ = (UniqueConstraint("code", name="app_function_code_key"), {"schema": "dms"})
    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    code: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)


class GroupPermission(Timestamps, Base):
    __tablename__ = "group_permission"
    __table_args__ = (
        UniqueConstraint("groupId", "functionId", name="group_permission_groupId_functionId_key"),
        Index("ix_group_permission_function", "functionId"),
        {"schema": "dms"},
    )
    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    group_id: Mapped[int] = mapped_column(
        "groupId", ForeignKey("dms.user_group.id", ondelete="RESTRICT")
    )
    function_id: Mapped[int] = mapped_column(
        "functionId", ForeignKey("dms.app_function.id", ondelete="RESTRICT")
    )
    is_allowed: Mapped[bool] = mapped_column("isAllowed", Boolean, server_default=text("false"))


class AuthToken(Timestamps, Base):
    __tablename__ = "auth_token"
    __table_args__ = (
        UniqueConstraint("tokenDigest", name="auth_token_tokenDigest_key"),
        Index("ix_auth_token_user", "userId", "purpose"),
        Index("ix_auth_token_expiry", "expiresAt", postgresql_where=text('"revokedAt" IS NULL')),
        Index("ix_auth_token_session", "userId", "sessionId"),
        Index(
            "uq_auth_token_live_session",
            "sessionId",
            unique=True,
            postgresql_where=text("purpose = 'REFRESH' AND \"revokedAt\" IS NULL"),
        ),
        {"schema": "dms"},
    )
    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        "userId", ForeignKey("dms.app_user.id", ondelete="RESTRICT")
    )
    purpose: Mapped[str] = mapped_column(Text)
    token_digest: Mapped[bytes] = mapped_column("tokenDigest", LargeBinary)
    expires_at: Mapped[datetime] = mapped_column("expiresAt", DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column("revokedAt", DateTime(timezone=True))
    auth_version: Mapped[int] = mapped_column("authVersion", Integer)
    session_id: Mapped[UUID | None] = mapped_column("sessionId")
