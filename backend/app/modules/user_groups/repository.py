from sqlalchemy import Select, delete, func, select
from sqlalchemy.orm import Session

from app.modules.auth.models import GroupPermission
from app.modules.user_groups.models import UserGroup
from app.modules.users.models import AppUser


class GroupRepository:
    """Group persistence on the caller's session; never commits or rolls back."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def query(self) -> Select[tuple[UserGroup, int]]:
        count = (
            select(func.count(AppUser.id))
            .where(AppUser.group_id == UserGroup.id)
            .correlate(UserGroup)
            .scalar_subquery()
        )
        return select(UserGroup, count.label("user_count")).execution_options(
            populate_existing=True
        )

    def lock(self, identifier: int) -> UserGroup | None:
        return self.session.scalar(
            select(UserGroup)
            .where(UserGroup.id == identifier)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def create(self, *, code: str, name: str) -> UserGroup:
        group = UserGroup(code=code, name=name)
        self.session.add(group)
        self.session.flush()
        return group

    def update(self, identifier: int, values: dict[str, str]) -> None:
        self.session.execute(
            UserGroup.__table__.update().where(UserGroup.id == identifier).values(**values)
        )

    def delete(self, identifier: int) -> None:
        self.session.execute(delete(GroupPermission).where(GroupPermission.group_id == identifier))
        self.session.execute(delete(UserGroup).where(UserGroup.id == identifier))
