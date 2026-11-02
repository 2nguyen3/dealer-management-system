from decimal import Decimal

from sqlalchemy import Identity, Integer, Numeric, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import DOMAIN
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps


class AgencyType(Timestamps, Base):
    __tablename__ = "agency_type"
    __table_args__ = (
        UniqueConstraint("code", name="agency_type_code_key"),
        UniqueConstraint("name", name="agency_type_name_key"),
        {"schema": "dms"},
    )
    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    code: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    max_debt: Mapped[Decimal] = mapped_column(
        "maxDebt", DOMAIN("money_vnd", Numeric(), schema="dms", create_type=False)
    )
    status: Mapped[str] = mapped_column(Text, server_default=text("'ACTIVE'"))
