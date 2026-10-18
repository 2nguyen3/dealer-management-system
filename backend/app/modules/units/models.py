from sqlalchemy import Boolean, Identity, Integer, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps


class Unit(Timestamps, Base):
    __tablename__ = "unit"
    __table_args__ = (
        UniqueConstraint("code", name="unit_code_key"),
        UniqueConstraint("name", name="unit_name_key"),
        {"schema": "dms"},
    )
    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    code: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    allows_fraction: Mapped[bool] = mapped_column(
        "allowsFraction", Boolean, server_default=text("false")
    )
    status: Mapped[str] = mapped_column(Text, server_default=text("'ACTIVE'"))
