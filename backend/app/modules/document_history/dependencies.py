from functools import partial

from fastapi import Request

from app.common.catalogue_http import (
    AuthDependency,
    PrincipalDependency,
    SessionDependency,
    make_service,
)
from app.modules.document_history.service import DocumentHistoryService


def get_history_service(
    request: Request,
    session: SessionDependency,
    principal: PrincipalDependency,
    auth: AuthDependency,
) -> DocumentHistoryService:
    def allowed_functions():
        return auth.get_current_user(principal).allowedFunctions

    return make_service(
        partial(DocumentHistoryService, allowed_functions=allowed_functions),
        request,
        session,
        principal,
        auth,
    )
