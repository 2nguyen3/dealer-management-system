"""Payment rules shared by counter receipts and VNPAY, under the agency row lock."""

from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError


def check_payment_amount(amount: Decimal, debt: Decimal) -> None:
    if amount > debt:
        raise ApiError(
            409,
            "PAYMENT_EXCEEDS_DEBT",
            "Payment exceeds the current debt",
            details={"debt": str(debt), "amount": str(amount)},
        )


def check_no_open_payment(session: Session, agency_id: int, *, draft_id: int | None = None) -> None:
    # Run AFTER acquiring the agency lock: this separate READ COMMITTED statement
    # sees the winner of a concurrent creation, even if it didn't change the debt.
    unfinished = session.scalar(
        text("""
            SELECT EXISTS (
                SELECT 1 FROM dms.document WHERE "agencyId" = :agency
                  AND kind = 'PAYMENT_RECEIPT' AND status = 'DRAFT' AND id IS DISTINCT FROM :draft
            ) OR EXISTS (
                -- Nothing writes EXPIRED back; a lapsed checkout can no longer be paid.
                SELECT 1 FROM dms.online_payment WHERE "agencyId" = :agency
                  AND status = 'PENDING' AND "expiresAt" > dms.app_now()
            )
        """),
        {"agency": agency_id, "draft": draft_id},
    )
    if unfinished:
        raise ApiError(409, "PAYMENT_IN_PROGRESS", "Agency already has an unfinished payment")
