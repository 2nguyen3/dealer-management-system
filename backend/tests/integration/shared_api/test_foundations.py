import pytest
from sqlalchemy import column, select, table, text
from sqlalchemy.orm import Session

from app.common.pagination import SortSpec, literal_search
from app.common.preconditions import canonical_etag
from app.core.request_context import set_audit_context

pytestmark = pytest.mark.integration


def test_audit_context_and_parent_child_etag(engine, actor):
    with Session(engine) as session:
        with pytest.raises(ValueError):
            set_audit_context(session, actor, "x", function_code="invalid")
        set_audit_context(session, actor, "business-audit", function_code="unit.manage")
        session.execute(text("INSERT INTO dms.unit (code,name) VALUES ('CONTEXT','Context')"))
        session.commit()
        record = session.execute(
            text(
                'SELECT "actorId","actorType","functionCode","requestId" '
                "FROM dms.audit_log WHERE \"requestId\"='business-audit'"
            )
        ).one()
        assert tuple(record) == (actor, "USER", "unit.manage", "business-audit")
        set_audit_context(session, actor, "will-clear", function_code="unit.manage")
        set_audit_context(session, None, "system-audit", function_code="unit.manage")
        session.execute(text("INSERT INTO dms.unit (code,name) VALUES ('SYSTEM','System')"))
        session.commit()
        record = session.execute(
            text(
                'SELECT "actorId","actorType" FROM dms.audit_log WHERE "requestId"=\'system-audit\''
            )
        ).one()
        assert tuple(record) == (None, "SYSTEM")
        session.rollback()
        assert not session.scalar(text("SELECT current_setting('dms.actor_id', true)"))
        assert not session.scalar(text("SELECT current_setting('dms.request_id', true)"))
        first = canonical_etag("probe:1", {"value": 0, "children": []})
        session.execute(text("INSERT INTO dms.probe_child VALUES (1,1)"))
        session.commit()
        children = session.scalars(
            text("SELECT id FROM dms.probe_child WHERE parent=1 ORDER BY id")
        ).all()
        assert canonical_etag("probe:1", {"value": 0, "children": children}) != first


@pytest.mark.parametrize(
    "sort,expected",
    [("name", [1, 2, 3]), ("-name", [3, 2, 1]), ("id", [1, 2, 3]), ("-id", [3, 2, 1])],
)
def test_real_keyset_ties_and_literal_search(engine, sort, expected):
    probe = table("probe", column("id"), column("name"), schema="dms")
    registry = {"name": ("name", "id"), "-name": ("name", "id"), "id": ("id",), "-id": ("id",)}
    specification = SortSpec.parse(sort, registry)
    columns = {"id": probe.c.id, "name": probe.c.name}
    actual, last = [], None
    with engine.connect() as connection:
        while True:
            query = select(probe).order_by(*specification.ordering(columns)).limit(1)
            if last is not None:
                query = query.where(specification.after(columns, last))
            row = connection.execute(query).mappings().one_or_none()
            if row is None:
                break
            actual.append(row["id"])
            last = [row[name] for name in specification.fields]
        assert actual == expected
        query = select(probe).where(probe.c.name.ilike(literal_search("%_"), escape="\\"))
        assert connection.execute(query).all() == []
