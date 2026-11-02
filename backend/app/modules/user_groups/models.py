from sqlalchemy import Identity, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps


class UserGroup(Timestamps, Base):
    __tablename__ = "user_group"
    __table_args__ = (
        UniqueConstraint("code", name="user_group_code_key"),
        UniqueConstraint("name", name="user_group_name_key"),
        {"schema": "dms"},
    )
    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    code: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
