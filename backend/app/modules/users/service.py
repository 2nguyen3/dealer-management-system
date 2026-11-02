from datetime import UTC, datetime

from app.common.catalogue import CatalogueService
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.core.security import hash_password
from app.modules.auth.schemas import UserResponse
from app.modules.auth.service import invalidate_user_sessions
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import AdminPasswordReset, UserCreate, UserListResponse, UserUpdate


class UserAdministrationService(CatalogueService):
    repository = UserRepository
    response_model = UserResponse
    list_model = UserListResponse
    permission = "users.manage"
    operation = "listUsers"
    search_fields = ("fullName", "email")
    sorts = {
        sort: (field,) if field == "id" else (field, "id")
        for field in ("id", "fullName", "email", "createdAt")
        for sort in (field, "-" + field)
    }
    conflicts = {
        ("23505", "uq_app_user_email_ci"): ("DUPLICATE", "Email already exists"),
        ("23503", "app_user_groupId_fkey"): ("RESOURCE_IN_USE", "Group is unavailable"),
    }

    def require_group(self, identifier: int) -> None:
        if self.repo.group(identifier) is None:
            raise ApiError(404, "NOT_FOUND", "Group not found")

    def create(self, body: UserCreate) -> UserResponse:
        password_hash = hash_password(body.password)

        def work():
            self.require_group(body.groupId)
            self.authorize((self.permission,))
            identifier = self.repo.create(
                {
                    "full_name": body.fullName,
                    "email": body.email,
                    "password_hash": password_hash,
                    "group_id": body.groupId,
                    "status": body.status,
                }
            )
            return lambda: self.get(identifier)

        return self.write(work)

    def update(
        self, identifier: int, body: UserUpdate, preconditions: Preconditions
    ) -> UserResponse:
        def work():
            row = self.repo.lock(identifier)
            if row is None:
                raise ApiError(404, "NOT_FOUND", "User not found")
            self.authorize((self.permission,))
            values = body.model_dump(exclude_unset=True)
            for group_id in sorted({row.group_id, values.get("groupId", row.group_id)}):
                self.require_group(group_id)
            self.authorize((self.permission,))
            preconditions.compare(self.etag(self.get(identifier)))
            invalidate = (
                values.get("groupId", row.group_id) != row.group_id
                or values.get("status", row.status) != row.status
            )
            self.repo.update(identifier, values)
            if invalidate:
                invalidate_user_sessions(self.session, identifier, datetime.now(UTC))
            return lambda: self.get(identifier)

        return self.write(work)

    def reset_password(
        self, identifier: int, body: AdminPasswordReset, preconditions: Preconditions
    ) -> None:
        password_hash = hash_password(body.newPassword)

        def work():
            row = self.repo.lock(identifier)
            if row is None:
                raise ApiError(404, "NOT_FOUND", "User not found")
            self.authorize((self.permission,))
            self.require_group(row.group_id)
            self.authorize((self.permission,))
            preconditions.compare(self.etag(self.get(identifier)))
            self.repo.update(identifier, {"passwordHash": password_hash})
            invalidate_user_sessions(self.session, identifier, datetime.now(UTC))
            return lambda: None

        self.write(work)
