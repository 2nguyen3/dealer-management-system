from sqlalchemy import String, cast, select

from app.common.catalogue import CatalogueRepository
from app.modules.user_groups.models import UserGroup
from app.modules.users.models import AppUser


class UserRepository(CatalogueRepository):
    model = AppUser
    columns = {
        "id": AppUser.id,
        "fullName": AppUser.full_name,
        "email": AppUser.email,
        "groupId": AppUser.group_id,
        "status": AppUser.status,
        "createdAt": AppUser.created_at,
        "updatedAt": AppUser.updated_at,
    }

    def query(self):
        return select(
            cast(AppUser.id, String).label("id"),
            *(column.label(name) for name, column in self.columns.items() if name != "id"),
            UserGroup.code.label("groupCode"),
            UserGroup.name.label("groupName"),
        ).join(UserGroup, UserGroup.id == AppUser.group_id)

    def group(self, identifier: int) -> UserGroup | None:
        return self.session.scalar(
            select(UserGroup).where(UserGroup.id == identifier).with_for_update(read=True)
        )
