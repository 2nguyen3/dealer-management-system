import pytest
from sqlalchemy import text

from tests.support.contract import SOURCE

pytestmark = pytest.mark.integration
OWNED = {"Permissions", "Audit Logs", "Business Rules", "Products", "Agencies"}
OPERATIONS = [
    (method, path, operation)
    for path, methods in SOURCE["paths"].items()
    for method, operation in methods.items()
    if method != "parameters" and OWNED.intersection(operation["tags"])
]


@pytest.mark.parametrize(
    "method,path,operation", OPERATIONS, ids=[item[2]["operationId"] for item in OPERATIONS]
)
def test_every_new_operation_missing_false_and_anonymous_denial(
    client, engine, method, path, operation
):
    path = "/api/v1" + path
    for field in ("groupId", "functionId", "auditId", "agencyId", "productId"):
        path = path.replace("{" + field + "}", "999999")
    required = operation["x-permissions"].get("allOf", operation["x-permissions"].get("anyOf"))
    with engine.begin() as c:
        c.execute(
            text(
                'UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1 '
                'AND "functionId" IN (SELECT id FROM dms.app_function WHERE code=ANY(:codes))'
            ),
            {"codes": required},
        )
    response = client.request(method, path, json={"name": "x", "isAllowed": True, "reason": "x"})
    assert response.status_code == 403, response.text
    with engine.begin() as c:
        c.execute(
            text(
                'DELETE FROM dms.group_permission WHERE "groupId"=1 '
                'AND "functionId" IN (SELECT id FROM dms.app_function WHERE code=ANY(:codes))'
            ),
            {"codes": required},
        )
    assert client.request(method, path, json={}).status_code == 403
    client.headers.pop("Authorization")
    assert client.request(method, path, json={}).status_code == 401
