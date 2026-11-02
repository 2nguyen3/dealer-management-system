from app.core.exceptions import ApiError


def reversal_values(original: dict, batch_id: int, *, value_field: str) -> dict:
    """Construct an exact append-only reversal after caller locks/loads effectiveness."""
    if value_field not in ("quantity", "amount"):
        raise ValueError("Invalid ledger value field")
    if original["reversesEntryId"] is not None or not original["isEffective"]:
        raise ApiError(409, "REVERSAL_CONFLICT", "Only effective originals can be reversed")
    values = {
        key: value
        for key, value in original.items()
        if key not in ("id", "batchId", "createdAt", "updatedAt", "isEffective")
    }
    return {
        **values,
        "batchId": batch_id,
        "reversesEntryId": original["id"],
        value_field: -original[value_field],
    }
