from uuid import uuid4

from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.modules.document_corrections.manual_receipts import ManualReceiptCorrectionService
from app.modules.payment_receipts.schemas import PaymentReceiptCorrection
from app.modules.payment_receipts.service import PaymentReceiptService
from tests.integration.settlement_core.helpers import commit, financial, issue


def manual_service(session, actor, authorize=lambda _: None):
    return ManualReceiptCorrectionService(
        PaymentReceiptService(session, CursorCodec(b"x" * 32), actor, "m29-manual", authorize)
    )


def manual_body(amount="100", day="2026-01-03", **values):
    return PaymentReceiptCorrection.model_validate(
        {
            "businessDate": day,
            "amount": amount,
            "paymentMethod": "BANK_TRANSFER",
            "reason": "Wrong amount on original record",
            **values,
        }
    )


def manual_condition(engine, actor, identifier):
    with Session(engine) as session:
        owner = manual_service(session, actor).owner
        return Preconditions(owner.etag(owner.core.get(identifier, check_permission=False)))


def timeline(engine, actor, trading):
    with Session(engine) as session:
        invoices = [issue(session, actor, trading, quantity=2, day=day) for day in (2, 4, 6)]
        commit(session)
        receipts = []
        for day, amount in ((3, 150), (5, 200), (7, 200)):
            identifier = financial(session, actor, trading[0], amount, day=day)
            manual_service(session, actor).settlement.post_receipt(identifier, uuid4())
            commit(session)
            receipts.append(identifier)
        return invoices, receipts
