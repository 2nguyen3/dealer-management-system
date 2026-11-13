from sqlalchemy import Identity, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps


class Ward(Timestamps, Base):
    """Read-only HCMC 2025 ward/commune/special-zone catalogue loaded by revision 0010."""

    __tablename__ = "ward"
    __table_args__ = (
        UniqueConstraint("code", name="ward_code_key"),
        UniqueConstraint("name", name="ward_name_key"),
        {"schema": "dms"},
    )
    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    code: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(Text)
