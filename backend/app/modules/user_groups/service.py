from collections.abc import Callable
from typing import cast

from sqlalchemy import Select, or_, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec, SortSpec, build_page, cursor_error, literal_search
from app.common.preconditions import Preconditions, canonical_etag
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.core.transactions import translate_database_error
from app.modules.user_groups.models import UserGroup
from app.modules.user_groups.repository import GroupRepository
from app.modules.user_groups.schemas import (
    GroupCreate,
    GroupListResponse,
    GroupResponse,
    GroupUpdate,
)

SORTS = {
    "id": ("id",),
    "-id": ("id",),
    "code": ("code", "id"),
    "-code": ("code", "id"),
    "name": ("name", "id"),
    "-name": ("name", "id"),
}
CONFLICTS = {
    ("23505", "user_group_code_key"): ("DUPLICATE", "Group code already exists"),
    ("23505", "user_group_name_key"): ("DUPLICATE", "Group name already exists"),
    ("23503", "app_user_groupId_fkey"): ("RESOURCE_IN_USE", "Group has accounts"),
}


def group_etag(group: GroupResponse) -> str:
    return canonical_etag(f"group:{group.id}", group.model_dump(mode="json"))


def to_group_response(group: UserGroup, count: int) -> GroupResponse:
    return GroupResponse(
        id=group.id,
        code=group.code,
        name=group.name,
        userCount=count,
        createdAt=group.created_at,
        updatedAt=group.updated_at,
    )


class GroupService:
    def __init__(
        self,
        session: Session,
        codec: CursorCodec,
        actor_id: int,
        request_id: str,
        authorize: Callable[[tuple[str, ...]], None],
    ) -> None:
        self.session = session
        self.repo = GroupRepository(session)
        self.codec = codec
        self.actor_id = actor_id
        self.request_id = request_id
        self.authorize = authorize

    def query(self) -> Select[tuple[UserGroup, int]]:
        return self.repo.query()

    def get(self, identifier: int) -> GroupResponse:
        row = self.session.execute(self.query().where(UserGroup.id == identifier)).one_or_none()
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Group not found")
        return to_group_response(row[0], row[1])

    def list(
        self,
        *,
        limit: int = 25,
        cursor: str | None = None,
        q: str | None = None,
        code: str | None = None,
        sort: str = "id",
    ) -> GroupListResponse:
        specification = SortSpec.parse(sort, SORTS)
        columns = {"id": UserGroup.id, "code": UserGroup.code, "name": UserGroup.name}
        scope = {
            "operation": "listUserGroups",
            "boundary": "anchor-v1",
            "q": q.strip() if q is not None else None,
            "code": code,
            "sort": sort,
        }
        query = self.query()
        if q is not None:
            pattern = literal_search(q)
            query = query.where(
                or_(
                    UserGroup.code.ilike(pattern, escape="\\"),
                    UserGroup.name.ilike(pattern, escape="\\"),
                )
            )
        if code is not None:
            query = query.where(UserGroup.code == code)
        if cursor is not None:
            anchor_id = self.codec.decode(cursor, scope, [int])[0]
            anchor = self.session.execute(
                self.query().where(UserGroup.id == anchor_id)
            ).one_or_none()
            if anchor is None:
                raise cursor_error()
            item = to_group_response(anchor[0], anchor[1])
            values = [getattr(item, field) for field in specification.fields]
            query = query.where(specification.after(columns, values))
        rows = self.session.execute(
            query.order_by(*specification.ordering(columns)).limit(limit + 1)
        ).all()
        items, pagination = build_page(
            [to_group_response(row[0], row[1]) for row in rows],
            limit,
            self.codec,
            scope,
            lambda item: [item.id],
        )
        return GroupListResponse(items=items, pagination=pagination)

    def lock(self, identifier: int) -> None:
        group = self.repo.lock(identifier)
        if group is None:
            raise ApiError(404, "NOT_FOUND", "Group not found")

    def write[T: GroupResponse | None](self, work: Callable[[], Callable[[], T]]) -> T:
        try:
            set_audit_context(
                self.session, self.actor_id, self.request_id, function_code="groups.manage"
            )
            project = work()
            self.session.flush()
            self.session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
            result = project()
            if result is not None:
                result = cast(T, GroupResponse.model_validate(result.model_dump(mode="json")))
            self.session.commit()
            return result
        except DBAPIError as error:
            self.session.rollback()
            raise translate_database_error(error, CONFLICTS) from None
        except Exception:
            self.session.rollback()
            raise

    def create(self, body: GroupCreate) -> GroupResponse:
        def work() -> Callable[[], GroupResponse]:
            self.authorize(("groups.manage",))
            group = self.repo.create(code=body.code, name=body.name)
            return lambda: self.get(group.id)

        return self.write(work)

    def update(
        self, identifier: int, body: GroupUpdate, preconditions: Preconditions
    ) -> GroupResponse:
        def work() -> Callable[[], GroupResponse]:
            self.lock(identifier)
            self.authorize(("groups.manage",))
            preconditions.compare(group_etag(self.get(identifier)))
            self.repo.update(identifier, body.model_dump(exclude_unset=True))
            return lambda: self.get(identifier)

        return self.write(work)

    def delete(self, identifier: int, preconditions: Preconditions) -> None:
        def work() -> Callable[[], None]:
            self.lock(identifier)
            self.authorize(("groups.manage", "permissions.manage"))
            group = self.get(identifier)
            preconditions.compare(group_etag(group))
            if group.userCount:
                raise ApiError(409, "RESOURCE_IN_USE", "Group has accounts")
            self.repo.delete(identifier)
            return lambda: None

        self.write(work)
