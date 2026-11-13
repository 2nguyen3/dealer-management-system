"""Deployment helpers for the read-only ward catalogue (revision 0010)."""


def open_ward(client) -> int:
    """Return a ward id with a free active-agency slot, paging the read-only catalogue."""
    params = {"limit": 100}
    while True:
        page = client.get("/api/v1/wards", params=params)
        assert page.status_code == 200, page.text
        body = page.json()
        for item in body["items"]:
            if item["remainingSlots"] > 0:
                return item["id"]
        if not body["pagination"]["hasMore"]:
            raise AssertionError("No ward has a remaining agency slot")
        params["cursor"] = body["pagination"]["nextCursor"]
