from sqlalchemy import Identity, Integer, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps


class District(Timestamps, Base):
    __tablename__ = "district"
    __table_args__ = (
        UniqueConstraint("code", name="district_code_key"),
        UniqueConstraint("name", name="district_name_key"),
        {"schema": "dms"},
    )
    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    code: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, server_default=text("'ACTIVE'"))
