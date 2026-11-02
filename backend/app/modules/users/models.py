from sqlalchemy import (
    BigInteger,
    FetchedValue,
    ForeignKey,
    Identity,
    Index,
    Integer,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps


class AppUser(Timestamps, Base):
    __tablename__ = "app_user"
    __table_args__ = {"schema": "dms"}
    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    full_name: Mapped[str] = mapped_column("fullName", Text)
    email: Mapped[str] = mapped_column(Text)
    password_hash: Mapped[str] = mapped_column("passwordHash", Text)
    group_id: Mapped[int] = mapped_column(
        "groupId", ForeignKey("dms.user_group.id", ondelete="RESTRICT")
    )
    status: Mapped[str] = mapped_column(Text, server_default=text("'ACTIVE'"))
    auth_version: Mapped[int] = mapped_column(
        "authVersion", Integer, server_default=text("1"), server_onupdate=FetchedValue()
    )


Index("uq_app_user_email_ci", func.lower(AppUser.email), unique=True)
Index("ix_app_user_group", AppUser.group_id, AppUser.id)
