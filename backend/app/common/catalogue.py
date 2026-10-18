"""Shared catalogue mechanics; feature repositories own projections and business guards."""

from collections.abc import Callable
from typing import ClassVar, Literal

from pydantic import BaseModel, Field, model_validator
from sqlalchemy import delete, or_, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec, SortSpec, build_page, cursor_error, literal_search
from app.common.preconditions import Preconditions, canonical_etag
from app.common.schemas import ApiModel, CatalogId, Instant, NonEmptyText
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.core.transactions import translate_database_error

CATALOG_SORTS = {
    sort: (field,) if field == "id" else (field, "id")
    for field in ("id", "code", "name")
    for sort in (field, "-" + field)
}


class PatchModel(ApiModel):
    model_config = {"json_schema_extra": {"minProperties": 1}}

    @model_validator(mode="before")
    @classmethod
    def nonempty_patch(cls, value: object) -> object:
        if not isinstance(value, dict) or not value:
            raise ValueError("A nonempty update is required")
        return value


class MasterCreate(ApiModel):
    code: NonEmptyText
    name: NonEmptyText
    status: Literal["ACTIVE", "INACTIVE"] = "ACTIVE"


class MasterUpdate(PatchModel):
    code: NonEmptyText = None
    name: NonEmptyText = None
    status: Literal["ACTIVE", "INACTIVE"] = None


class MasterResponse(ApiModel):
    id: CatalogId
    code: str
    name: str
    status: Literal["ACTIVE", "INACTIVE"]
    createdAt: Instant = Field(json_schema_extra={"readOnly": True})
    updatedAt: Instant = Field(json_schema_extra={"readOnly": True})


class CatalogueRepository:
    model: ClassVar[type]
    columns: ClassVar[dict]

    def __init__(self, session: Session) -> None:
        self.session = session

    def query(self):
        return select(*(column.label(name) for name, column in self.columns.items()))

    def lock(self, identifier: int):
        return self.session.scalar(
            select(self.model)
            .where(self.model.id == identifier)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def create(self, values: dict) -> int:
        row = self.model(**values)
        self.session.add(row)
        self.session.flush()
        return row.id

    def update(self, identifier: int, values: dict) -> None:
        self.session.execute(
            self.model.__table__.update().where(self.model.id == identifier).values(**values)
        )

    def delete(self, identifier: int) -> None:
        self.session.execute(delete(self.model).where(self.model.id == identifier))


class CatalogueService:
    repository: ClassVar[type[CatalogueRepository]]
    response_model: ClassVar[type[BaseModel]]
    list_model: ClassVar[type[BaseModel]]
    permission: ClassVar[str]
    operation: ClassVar[str]
    sorts: ClassVar[dict] = CATALOG_SORTS
    search_fields: ClassVar[tuple[str, ...]] = ("code", "name")
    conflicts: ClassVar[dict] = {}

    def __init__(
        self,
        session: Session,
        codec: CursorCodec,
        actor_id: int,
        request_id: str,
        authorize: Callable[[tuple[str, ...]], None],
    ) -> None:
        self.session = session
        self.repo = self.repository(session)
        self.codec = codec
        self.actor_id = actor_id
        self.request_id = request_id
        self.authorize = authorize

    def get(self, identifier: int):
        row = (
            self.session.execute(self.repo.query().where(self.repo.model.id == identifier))
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Resource not found")
        return self.response_model.model_validate(dict(row))

    def etag(self, item: BaseModel) -> str:
        return canonical_etag(f"{self.operation}:{item.id}", item.model_dump(mode="json"))

    def cursor_boundary(self, item: BaseModel, specification: SortSpec) -> str:
        values = item.model_dump(mode="json")
        return canonical_etag(
            "cursor-boundary", {field: values[field] for field in specification.fields}
        )

    def list(
        self,
        *,
        limit: int = 25,
        cursor: str | None = None,
        q: str | None = None,
        sort: str = "id",
        **filters,
    ):
        specification = SortSpec.parse(sort, self.sorts)
        columns = self.repo.columns
        scope = {
            "operation": self.operation,
            "boundary": "anchor-v2",
            "sort": sort,
            "q": q.strip() if q is not None else None,
            **filters,
        }
        query = self.repo.query()
        if q is not None:
            pattern = literal_search(q)
            query = query.where(
                or_(*(columns[field].ilike(pattern, escape="\\") for field in self.search_fields))
            )
        for field, value in filters.items():
            if value is not None:
                if field in getattr(self.repo, "ranges", {}):
                    column, operator = self.repo.ranges[field]
                    query = query.where(operator(column, value))
                else:
                    query = query.where(columns[field] == value)
        if cursor is not None:
            identifier, boundary = self.codec.decode(cursor, scope, [int, str])
            row = (
                self.session.execute(query.where(self.repo.model.id == identifier))
                .mappings()
                .one_or_none()
            )
            if row is None:
                raise cursor_error()
            if (
                self.cursor_boundary(self.response_model.model_validate(dict(row)), specification)
                != boundary
            ):
                raise cursor_error()
            query = query.where(
                specification.after(
                    columns, [int(row[f]) if f == "id" else row[f] for f in specification.fields]
                )
            )
        rows = (
            self.session.execute(query.order_by(*specification.ordering(columns)).limit(limit + 1))
            .mappings()
            .all()
        )
        items, pagination = build_page(
            [self.response_model.model_validate(dict(row)) for row in rows],
            limit,
            self.codec,
            scope,
            lambda item: [int(item.id), self.cursor_boundary(item, specification)],
        )
        return self.list_model(items=items, pagination=pagination)

    def write(self, work: Callable):
        try:
            set_audit_context(
                self.session, self.actor_id, self.request_id, function_code=self.permission
            )
            self.authorize((self.permission,))
            project = work()
            self.session.flush()
            self.session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
            result = project()
            self.session.commit()
            return result
        except DBAPIError as error:
            self.session.rollback()
            raise translate_database_error(error, self.conflicts) from None
        except Exception:
            self.session.rollback()
            raise

    def create(self, body: BaseModel):
        def work():
            identifier = self.repo.create(body.model_dump())
            return lambda: self.get(identifier)

        return self.write(work)

    def validate_update(self, row, values: dict) -> None:
        self.repo.validate_update(row, values)

    def update(self, identifier: int, body: BaseModel, preconditions: Preconditions):
        def work():
            row = self.repo.lock(identifier)
            if row is None:
                raise ApiError(404, "NOT_FOUND", "Resource not found")
            self.authorize((self.permission,))
            preconditions.compare(self.etag(self.get(identifier)))
            values = body.model_dump(exclude_unset=True)
            self.validate_update(row, values)
            self.authorize((self.permission,))
            self.repo.update(identifier, values)
            return lambda: self.get(identifier)

        return self.write(work)

    def delete(self, identifier: int, preconditions: Preconditions) -> None:
        def work():
            if self.repo.lock(identifier) is None:
                raise ApiError(404, "NOT_FOUND", "Resource not found")
            self.authorize((self.permission,))
            preconditions.compare(self.etag(self.get(identifier)))
            if self.repo.references(identifier):
                raise ApiError(409, "RESOURCE_IN_USE", "Resource is referenced")
            self.repo.delete(identifier)
            return lambda: None

        self.write(work)
