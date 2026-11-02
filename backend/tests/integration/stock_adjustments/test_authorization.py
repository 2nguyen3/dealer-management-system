from uuid import uuid4

import pytest
from sqlalchemy import text

from tests.support.contract import SOURCE

pytestmark = pytest.mark.integration


def test_new_routes_deny_false_grants_before_resource_access(client, engine):
    with engine.begin() as connection:
        connection.execute(
            text('UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1')
        )
    owners = {"Stock Adjustments", "Stock Counts", "Sales Returns", "Agency Credit"}
    for path, methods in SOURCE["paths"].items():
        for method, operation in methods.items():
            if not isinstance(operation, dict) or not owners.intersection(
                operation.get("tags", [])
            ):
                continue
            if "balance" in path or path.endswith(("/cancel", "/corrections")):
                continue
            concrete = path
            for parameter in ("documentId", "countId", "lineId", "agencyId", "lotId"):
                concrete = concrete.replace("{" + parameter + "}", "999999")
            arguments = {"headers": {"Idempotency-Key": str(uuid4()), "If-Match": '"safe"'}}
            if "requestBody" in operation:
                arguments["json"] = {}
            response = client.request(method, "/api/v1" + concrete, **arguments)
            assert response.status_code == 403, (operation["operationId"], response.text)
