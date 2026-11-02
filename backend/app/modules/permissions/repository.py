from sqlalchemy import String, cast, select

from app.common.catalogue import CatalogueRepository
from app.core.exceptions import ApiError
from app.modules.auth.models import AppFunction, GroupPermission
from app.modules.user_groups.models import UserGroup


class FunctionRepository(CatalogueRepository):
    model = AppFunction
    columns = {
        "id": AppFunction.id,
        "code": AppFunction.code,
        "name": AppFunction.name,
        "createdAt": AppFunction.created_at,
        "updatedAt": AppFunction.updated_at,
    }


class PermissionRepository(CatalogueRepository):
    model = GroupPermission
    columns = {
        "id": GroupPermission.id,
        "groupId": GroupPermission.group_id,
        "functionId": GroupPermission.function_id,
        "functionCode": AppFunction.code,
        "functionName": AppFunction.name,
        "isAllowed": GroupPermission.is_allowed,
        "createdAt": GroupPermission.created_at,
        "updatedAt": GroupPermission.updated_at,
    }

    def query(self):
        return select(
            cast(GroupPermission.id, String).label("id"),
            *(column.label(name) for name, column in self.columns.items() if name != "id"),
        ).join(AppFunction, AppFunction.id == GroupPermission.function_id)

    def require_group(self, identifier: int, *, lock: bool = False) -> None:
        query = select(UserGroup.id).where(UserGroup.id == identifier)
        if lock:
            query = query.with_for_update()
        if self.session.scalar(query) is None:
            raise ApiError(404, "NOT_FOUND", "Group not found")
