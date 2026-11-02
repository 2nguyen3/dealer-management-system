from sqlalchemy import select

from app.common.catalogue import CatalogueService
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.auth.models import AppFunction, GroupPermission
from app.modules.permissions.repository import FunctionRepository, PermissionRepository
from app.modules.permissions.schemas import (
    FunctionListResponse,
    FunctionResponse,
    PermissionListResponse,
    PermissionResponse,
    PermissionSet,
)


class FunctionService(CatalogueService):
    repository = FunctionRepository
    response_model = FunctionResponse
    list_model = FunctionListResponse
    permission = "permissions.manage"
    operation = "listFunctions"


class PermissionService(CatalogueService):
    repository = PermissionRepository
    response_model = PermissionResponse
    list_model = PermissionListResponse
    permission = "permissions.manage"
    operation = "listGroupPermissions"
    sorts = {value: (value.lstrip("-"),) for value in ("functionId", "-functionId", "id", "-id")}

    def list(self, *, groupId: int, **filters):
        self.repo.require_group(groupId)
        return super().list(groupId=groupId, **filters)

    def get_pair(self, group_id: int, function_id: int):
        row = (
            self.session.execute(
                self.repo.query().where(
                    GroupPermission.group_id == group_id, GroupPermission.function_id == function_id
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Permission not found")
        return PermissionResponse.model_validate(dict(row))

    def set(self, group_id: int, function_id: int, body: PermissionSet, condition: Preconditions):
        created = False

        def work():
            nonlocal created
            self.repo.require_group(group_id, lock=True)
            self.authorize((self.permission,))
            if (
                self.session.scalar(select(AppFunction.id).where(AppFunction.id == function_id))
                is None
            ):
                raise ApiError(404, "NOT_FOUND", "Function not found")
            grant = self.session.scalar(
                select(GroupPermission)
                .where(
                    GroupPermission.group_id == group_id,
                    GroupPermission.function_id == function_id,
                )
                .execution_options(populate_existing=True)
            )
            condition.compare(
                None if grant is None else self.etag(self.get_pair(group_id, function_id))
            )
            created = grant is None
            if created:
                self.session.add(
                    GroupPermission(
                        group_id=group_id, function_id=function_id, is_allowed=body.isAllowed
                    )
                )
            else:
                grant.is_allowed = body.isAllowed
            return lambda: self.get_pair(group_id, function_id)

        return self.write(work), created
