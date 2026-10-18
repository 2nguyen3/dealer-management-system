from fastapi import Request

from app.common.catalogue_http import (
    AuthDependency,
    PrincipalDependency,
    SessionDependency,
    make_service,
)
from app.modules.stock_receipts.service import StockReceiptService


def get_stock_receipt_service(
    request: Request,
    session: SessionDependency,
    principal: PrincipalDependency,
    auth: AuthDependency,
):
    return make_service(StockReceiptService, request, session, principal, auth)
